import { isAdminInvoiceTransitionAllowed } from "./invoice-status.ts";
import { deriveChannel, selectChannelAccount, type PaymentChannel } from "./payment-channel.ts";

export type BulkAction = "APPROVE" | "MARK_PAID";
export type BulkInvoiceStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "VOID";

export type BulkInvoiceFilter = {
  billingMonth?: string;
  channel?: PaymentChannel;
  status?: BulkInvoiceStatus[];
  workerName?: string;
  period?: string;
  xero?: "failed";
};

export function buildBulkInvoiceWhere(filter: BulkInvoiceFilter, channelWorkerIds?: string[]) {
  const where: Record<string, unknown> = {};
  if (filter.billingMonth && /^\d{4}-\d{2}$/.test(filter.billingMonth)) {
    where.billingMonth = filter.billingMonth;
  }
  if (filter.status?.length) where.status = { in: filter.status };
  if (filter.workerName) {
    where.worker = { name: { contains: filter.workerName, mode: "insensitive" } };
  }
  if (filter.period) where.period = { contains: filter.period, mode: "insensitive" };
  if (filter.xero === "failed") Object.assign(where, { status: "PAID", xeroSynced: false });
  if (channelWorkerIds) where.workerId = { in: channelWorkerIds };
  return where;
}

export function transitionForAction(action: BulkAction) {
  return action === "APPROVE"
    ? { expected: "SUBMITTED" as const, target: "APPROVED" as const }
    : { expected: "APPROVED" as const, target: "PAID" as const };
}

// One guarded batch instead of a per-row loop: hundreds of sequential UPDATEs both
// wasted round-trips and tripped Neon's pooled-connection drops mid-run. The status
// guard lives in the WHERE clause, so concurrently-changed rows are skipped, never
// corrupted; applyBatch returns the ids that actually reached the target status.
export async function runGuardedTransitions(
  invoices: Array<{ id: string; status: BulkInvoiceStatus }>,
  action: BulkAction,
  applyBatch: (ids: string[], expected: BulkInvoiceStatus, target: BulkInvoiceStatus) => Promise<string[]>,
) {
  const { expected, target } = transitionForAction(action);
  const eligibleIds = invoices
    .filter((invoice) => invoice.status === expected && isAdminInvoiceTransitionAllowed(invoice.status, target))
    .map((invoice) => invoice.id);
  const transitionedIds = eligibleIds.length ? await applyBatch(eligibleIds, expected, target) : [];
  return { transitionedIds, skippedWrongStatus: invoices.length - transitionedIds.length };
}

type PaymentAccount = { type: string; isPreferred: boolean; email?: string | null };
type PaymentWorker = {
  id: string;
  name: string;
  paymentAccounts: PaymentAccount[];
  paymentMethod?: string | null;
  paymentAccount?: string | null;
  paymentNotes?: string | null;
  bankName?: string | null;
  swiftCode?: string | null;
  paypalEmail?: string | null;
  cryptoWallet?: string | null;
};

export type PaymentIncomplete = {
  workerId: string;
  name: string;
  channel: PaymentChannel;
  missing: string[];
};

export function findPaymentIncomplete(invoices: Array<{ worker: PaymentWorker }>): PaymentIncomplete[] {
  const workers = new Map(invoices.map((invoice) => [invoice.worker.id, invoice.worker]));
  const incomplete: PaymentIncomplete[] = [];
  for (const worker of workers.values()) {
    const channel = deriveChannel(worker);
    const hasLegacyPayment = [
      worker.paymentMethod,
      worker.paymentAccount,
      worker.paymentNotes,
      worker.bankName,
      worker.swiftCode,
      worker.paypalEmail,
      worker.cryptoWallet,
    ].some((value) => value?.trim());
    // Pre-phase3 payments run through TD/Wise export files outside the Portal, so a
    // missing account email must not block approval. Flag only workers with no
    // payment trail at all: no account for their rail AND no TD/legacy payment info.
    const account = selectChannelAccount(worker.paymentAccounts, channel);
    if (!account && worker.paymentAccounts.length === 0 && !hasLegacyPayment) {
      incomplete.push({ workerId: worker.id, name: worker.name, channel, missing: ["payment account"] });
    }
  }
  return incomplete;
}
