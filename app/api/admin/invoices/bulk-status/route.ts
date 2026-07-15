import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import {
  findPaymentIncomplete,
  runGuardedTransitions,
  transitionForAction,
  type BulkAction,
} from "@/lib/bulk-invoices";
import {
  resolveBulkInvoiceTargets,
  summarizeInvoices,
  syncBulkInvoicesToXero,
} from "@/lib/bulk-invoice-server";
import { bulkOperationDigest, invoicePaidWorkerNotification } from "@/lib/slack";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const body = await req.json();
  const action = body.action as BulkAction;
  if (action !== "APPROVE" && action !== "MARK_PAID") {
    return NextResponse.json({ error: "Invalid bulk action" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await resolveBulkInvoiceTargets(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid target" }, { status: 400 });
  }

  const excludedWorkerIds = new Set(
    Array.isArray(body.excludeWorkerIds)
      ? body.excludeWorkerIds.filter((id: unknown): id is string => typeof id === "string")
      : [],
  );
  const targets = resolved.filter((invoice) => !excludedWorkerIds.has(invoice.workerId));
  const summary = summarizeInvoices(targets);

  if (body.dryRun === true) {
    return NextResponse.json({
      targeted: targets.length,
      ...summary,
      paymentIncomplete: action === "APPROVE" ? findPaymentIncomplete(targets) : [],
    });
  }

  const transition = transitionForAction(action);
  const transitionResult = await runGuardedTransitions(targets, action, async (id, expected, target) => {
    const result = await db.invoice.updateMany({ where: { id, status: expected }, data: { status: target } });
    return result.count === 1;
  });
  const transitionedIds = new Set(transitionResult.transitionedIds);
  const transitionedInvoices = targets
    .filter((invoice) => transitionedIds.has(invoice.id))
    .map((invoice) => ({ ...invoice, status: transition.target }));

  const xero = action === "MARK_PAID"
    ? await syncBulkInvoicesToXero(transitionedInvoices)
    : { xeroSynced: 0, xeroFailed: 0, failedInvoices: [] };

  if (action === "MARK_PAID") {
    for (const invoice of transitionedInvoices) {
      if (invoice.worker.paymentType === "MANUAL") invoicePaidWorkerNotification(invoice, invoice.worker);
    }
  }
  if (transitionedInvoices.length > 0) {
    bulkOperationDigest({
      action,
      count: transitionedInvoices.length,
      ...summarizeInvoices(transitionedInvoices),
      xeroFailed: xero.xeroFailed,
    });
  }

  return NextResponse.json({
    targeted: targets.length,
    transitioned: transitionedInvoices.length,
    skippedWrongStatus: transitionResult.skippedWrongStatus,
    ...xero,
  });
}
