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

export async function runGuardedTransitions(
  invoices: Array<{ id: string; status: BulkInvoiceStatus }>,
  action: BulkAction,
  updateIfCurrent: (id: string, expected: BulkInvoiceStatus, target: BulkInvoiceStatus) => Promise<boolean>,
) {
  const { expected, target } = transitionForAction(action);
  const transitionedIds: string[] = [];
  let skippedWrongStatus = 0;
  for (const invoice of invoices) {
    if (!isAdminInvoiceTransitionAllowed(invoice.status, target)) {
      skippedWrongStatus += 1;
      continue;
    }
    const updated = await updateIfCurrent(invoice.id, expected, target);
    if (updated) transitionedIds.push(invoice.id);
    else skippedWrongStatus += 1;
  }
  return { transitionedIds, skippedWrongStatus };
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
    const channel = deriveChannel(worker.paymentAccounts);
    const account = selectChannelAccount(worker.paymentAccounts);
    if ((channel === "WISE" || channel === "PAYPAL") && !account?.email?.trim()) {
      incomplete.push({ workerId: worker.id, name: worker.name, channel, missing: ["email"] });
      continue;
    }
    const hasLegacyPayment = [
      worker.paymentMethod,
      worker.paymentAccount,
      worker.paymentNotes,
      worker.bankName,
      worker.swiftCode,
      worker.paypalEmail,
      worker.cryptoWallet,
    ].some((value) => value?.trim());
    if (channel === "MANUAL" && worker.paymentAccounts.length === 0 && !hasLegacyPayment) {
      incomplete.push({ workerId: worker.id, name: worker.name, channel, missing: ["payment account"] });
    }
  }
  return incomplete;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}
