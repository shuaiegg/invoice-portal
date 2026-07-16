export const PAYMENT_CHANNELS = ["WISE", "PAYPAL", "MANUAL"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  WISE: "Wise",
  PAYPAL: "PayPal",
  MANUAL: "Manual",
};

type ChannelAccount = { type: string; isPreferred: boolean };

export type ChannelWorker = {
  paymentMethod?: string | null;
  paymentAccounts: readonly ChannelAccount[];
};

// TD payroll's payment-method strings ("Wise", "PayPal", "Manual", "Bank transfer", …)
export function channelFromTdMethod(method: string | null | undefined): PaymentChannel | null {
  const normalized = method?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "wise") return "WISE";
  if (normalized === "paypal") return "PAYPAL";
  return "MANUAL";
}

// When the channel is known, the payout account of that type wins (preferred first
// within the type); otherwise fall back to preferred-or-single across all accounts.
export function selectChannelAccount<T extends ChannelAccount>(
  accounts: readonly T[],
  channel?: PaymentChannel,
): T | undefined {
  if (channel === "WISE" || channel === "PAYPAL") {
    const ofType = accounts.filter((candidate) => candidate.type === channel);
    const typed = ofType.find((candidate) => candidate.isPreferred) ?? ofType[0];
    if (typed) return typed;
  }
  return accounts.find((candidate) => candidate.isPreferred)
    ?? (accounts.length === 1 ? accounts[0] : undefined);
}

// TD payroll is the source of truth for the payout channel (product decision
// 2026-07-16): the worker.paymentMethod imported from TD's Payroll summary wins,
// and the worker's own preferred account only decides when TD has no value.
export function deriveChannel(worker: ChannelWorker): PaymentChannel {
  const fromTd = channelFromTdMethod(worker.paymentMethod);
  if (fromTd) return fromTd;
  const account = selectChannelAccount(worker.paymentAccounts);
  if (account?.type === "WISE") return "WISE";
  if (account?.type === "PAYPAL") return "PAYPAL";
  return "MANUAL";
}

export function filterWorkerIdsByChannel(
  workerChannels: ReadonlyMap<string, PaymentChannel>,
  channel: PaymentChannel,
): string[] {
  return [...workerChannels.entries()]
    .filter(([, workerChannel]) => workerChannel === channel)
    .map(([workerId]) => workerId);
}

export function parsePaymentChannel(value: string | null | undefined): PaymentChannel | null {
  const normalized = value?.toUpperCase();
  return PAYMENT_CHANNELS.find((channel) => channel === normalized) ?? null;
}
