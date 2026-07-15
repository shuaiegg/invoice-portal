import { db } from "./db";
import { Prisma } from "./generated/client/client";
import {
  buildBulkInvoiceWhere,
  mapWithConcurrency,
  type BulkInvoiceFilter,
} from "./bulk-invoices";
import { deriveChannel, parsePaymentChannel, type PaymentChannel } from "./payment-channel";
import { resolveWorkerIdsForChannel } from "./payment-channel-server";
import { syncInvoiceToXero } from "./xero";

export type BulkTargetInput = {
  invoiceIds?: string[];
  filter?: BulkInvoiceFilter & { channel?: PaymentChannel | string };
};

export async function resolveBulkInvoiceTargets(input: BulkTargetInput) {
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
    where,
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
    channelBreakdown[deriveChannel(invoice.worker.paymentAccounts)] += 1;
  }
  return { totalsByCurrency, channelBreakdown };
}

export async function syncBulkInvoicesToXero(
  invoices: Awaited<ReturnType<typeof resolveBulkInvoiceTargets>>,
) {
  const outcomes = await mapWithConcurrency(invoices, 5, async (invoice) => {
    try {
      await syncInvoiceToXero(invoice, invoice.worker);
      return { ok: true as const, invoice };
    } catch (error) {
      return {
        ok: false as const,
        invoice,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  });
  const failedInvoices = outcomes.flatMap((outcome) => outcome.ok ? [] : [{
    id: outcome.invoice.id,
    invoiceNumber: outcome.invoice.invoiceNumber,
    reason: outcome.reason,
  }]);
  return {
    xeroSynced: outcomes.length - failedInvoices.length,
    xeroFailed: failedInvoices.length,
    failedInvoices,
  };
}
