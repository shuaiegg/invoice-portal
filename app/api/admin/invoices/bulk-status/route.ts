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
import { logInvoiceStatusChangedBulk } from "@/lib/audit";
import { withConnectionRetry } from "@/lib/worker-import";

export const maxDuration = 300;

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.authorized) return adminCheck.response;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const session = adminCheck.session!;

  // Everything below returns JSON even on unexpected failures — an unhandled throw
  // gives the client an empty 500 body ("Unexpected end of JSON" in the UI).
  try {
    const body = await req.json();
    const action = body.action as BulkAction;
    if (action !== "APPROVE" && action !== "MARK_PAID") {
      return NextResponse.json({ error: "Invalid bulk action" }, { status: 400 });
    }
    const transition = transitionForAction(action);

    // Filter mode must be scoped to a settlement month — an unfiltered "select all"
    // must never resolve to the entire invoice table across all months.
    const usesFilter = !(Array.isArray(body.invoiceIds) && body.invoiceIds.length > 0);
    if (usesFilter && !/^\d{4}-\d{2}$/.test(body.filter?.billingMonth ?? "")) {
      return NextResponse.json(
        { error: "Select a billing month before running a bulk operation on all matching invoices" },
        { status: 400 },
      );
    }

    let resolved;
    try {
      // Only rows already in the action's source status: keeps dry-run counts/totals
      // honest and caps the blast radius at what can actually transition.
      resolved = await resolveBulkInvoiceTargets(body, { status: transition.expected });
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

    const transitionResult = await runGuardedTransitions(targets, action, async (ids, expected, target) => {
      // Single guarded batch UPDATE (WHERE status = expected skips concurrently-changed
      // rows); retried because Neon's pooled connections drop idle sockets.
      await withConnectionRetry(() =>
        db.invoice.updateMany({ where: { id: { in: ids }, status: expected }, data: { status: target } }),
      );
      const transitioned = await withConnectionRetry(() =>
        db.invoice.findMany({ where: { id: { in: ids }, status: target }, select: { id: true } }),
      );
      return transitioned.map((row) => row.id);
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
      await logInvoiceStatusChangedBulk(
        session.user.id,
        session.user.name ?? session.user.email,
        transitionedInvoices.map((invoice) => ({
          invoiceId: invoice.id,
          details: {
            invoiceNumber: invoice.invoiceNumber,
            workerName: invoice.worker.name,
            from: transition.expected,
            to: transition.target,
            bulk: true,
          },
        }))
      );
    }

    return NextResponse.json({
      targeted: targets.length,
      transitioned: transitionedInvoices.length,
      skippedWrongStatus: transitionResult.skippedWrongStatus,
      ...xero,
    });
  } catch (error) {
    console.error("Bulk status operation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk operation failed" },
      { status: 500 },
    );
  }
}
