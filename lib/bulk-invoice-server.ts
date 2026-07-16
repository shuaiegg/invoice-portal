import { db } from "./db";
import { Prisma } from "./generated/client/client";
import {
  buildBulkInvoiceWhere,
  type BulkInvoiceFilter,
} from "./bulk-invoices";
import { deriveChannel, parsePaymentChannel, type PaymentChannel } from "./payment-channel";
import { resolveWorkerIdsForChannel } from "./payment-channel-server";
import { createXeroDraftBills, getAccessToken, getTenantId, resolveXeroContactId } from "./xero";

export type BulkTargetInput = {
  invoiceIds?: string[];
  filter?: BulkInvoiceFilter & { channel?: PaymentChannel | string };
};

// `constraints` is merged last: callers pin the rows a bulk action may touch
// (e.g. { status: "SUBMITTED" } for APPROVE), so dry-run counts, totals, and the
// mutation all operate on exactly the transitionable set — and an unscoped filter
// can never resolve beyond it.
export async function resolveBulkInvoiceTargets(
  input: BulkTargetInput,
  constraints?: Prisma.InvoiceWhereInput,
) {
  let where: Prisma.InvoiceWhereInput;
  if (Array.isArray(input.invoiceIds) && input.invoiceIds.length > 0) {
    where = { id: { in: input.invoiceIds.filter((id): id is string => typeof id === "string") } };
  } else if (input.filter) {
    const channel = parsePaymentChannel(input.filter.channel);
    const channelWorkerIds = channel ? await resolveWorkerIdsForChannel(channel) : undefined;
    where = buildBulkInvoiceWhere(input.filter as BulkInvoiceFilter, channelWorkerIds) as Prisma.InvoiceWhereInput;
  } else {
    throw new Error("Provide invoiceIds or filter");
  }

  return db.invoice.findMany({
    where: { ...where, ...constraints },
    orderBy: { createdAt: "desc" },
    include: {
      worker: {
        include: {
          user: { select: { email: true } },
          paymentAccounts: true,
        },
      },
      lines: { orderBy: { order: "asc" } },
    },
  });
}

export function summarizeInvoices(invoices: Awaited<ReturnType<typeof resolveBulkInvoiceTargets>>) {
  const totalsByCurrency: Record<string, number> = {};
  const channelBreakdown: Record<PaymentChannel, number> = { WISE: 0, PAYPAL: 0, MANUAL: 0 };
  for (const invoice of invoices) {
    totalsByCurrency[invoice.currency] = (totalsByCurrency[invoice.currency] ?? 0) + invoice.totalAmount;
    channelBreakdown[deriveChannel(invoice.worker)] += 1;
  }
  return { totalsByCurrency, channelBreakdown };
}

const XERO_BILL_BATCH_SIZE = 50;

// Batched sync: one contact resolution per unique worker (permanently cached on
// Worker.xeroContactId, so usually zero Xero calls) + one POST per 50 bills. A full
// 260-invoice month costs ~6 Xero calls instead of ~780 — comfortably inside the
// 60-calls/min tenant limit and the function's time budget.
export async function syncBulkInvoicesToXero(
  invoices: Awaited<ReturnType<typeof resolveBulkInvoiceTargets>>,
) {
  const failedInvoices: Array<{ id: string; invoiceNumber: string; reason: string }> = [];
  if (invoices.length === 0) return { xeroSynced: 0, xeroFailed: 0, failedInvoices };

  let accessToken: string;
  let tenantId: string;
  try {
    accessToken = await getAccessToken();
    tenantId = await getTenantId();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      xeroSynced: 0,
      xeroFailed: invoices.length,
      failedInvoices: invoices.map((invoice) => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, reason })),
    };
  }

  // One contact per unique worker; a worker whose contact fails takes only their
  // own invoices into the failed set, never the batch.
  const workers = new Map(invoices.map((invoice) => [invoice.workerId, invoice.worker]));
  const contactIds = new Map<string, string>();
  const contactErrors = new Map<string, string>();
  for (const [workerId, worker] of workers) {
    try {
      contactIds.set(workerId, await resolveXeroContactId(accessToken, tenantId, worker));
    } catch (error) {
      contactErrors.set(workerId, error instanceof Error ? error.message : String(error));
    }
  }

  const ready: Array<{ invoice: (typeof invoices)[number]; contactId: string }> = [];
  for (const invoice of invoices) {
    const contactId = contactIds.get(invoice.workerId);
    if (contactId) ready.push({ invoice, contactId });
    else {
      failedInvoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason: contactErrors.get(invoice.workerId) ?? "Xero contact could not be resolved",
      });
    }
  }

  let xeroSynced = 0;
  for (let start = 0; start < ready.length; start += XERO_BILL_BATCH_SIZE) {
    const batch = ready.slice(start, start + XERO_BILL_BATCH_SIZE);
    let outcomes;
    try {
      outcomes = await createXeroDraftBills(accessToken, tenantId, batch);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      for (const { invoice } of batch) {
        failedInvoices.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, reason });
      }
      continue;
    }

    const succeeded = outcomes.filter((outcome) => outcome.xeroInvoiceId);
    if (succeeded.length) {
      // One UPDATE...FROM VALUES round trip: 50 individual updates inside a
      // $transaction blew Prisma's 5s transaction timeout on Neon and rolled
      // back rows whose Xero bills already existed.
      const ids = succeeded.map((outcome) => outcome.invoiceId);
      const xeroIds = succeeded.map((outcome) => outcome.xeroInvoiceId as string);
      await db.$executeRaw`
        UPDATE "Invoice" AS i
        SET "xeroSynced" = true, "xeroInvoiceId" = v.xero_id, "xeroSyncedAt" = NOW()
        FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${xeroIds}::text[]) AS xero_id) AS v
        WHERE i.id = v.id`;
      xeroSynced += succeeded.length;
    }
    for (const outcome of outcomes) {
      if (!outcome.xeroInvoiceId) {
        failedInvoices.push({ id: outcome.invoiceId, invoiceNumber: outcome.invoiceNumber, reason: outcome.error ?? "Xero rejected this invoice" });
      }
    }
  }

  return { xeroSynced, xeroFailed: failedInvoices.length, failedInvoices };
}
