export const PAYMENT_CHANNELS = ["WISE", "PAYPAL", "MANUAL"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  WISE: "Wise",
  PAYPAL: "PayPal",
  MANUAL: "Manual",
};

type ChannelAccount = { type: string; isPreferred: boolean };

export function selectChannelAccount<T extends ChannelAccount>(accounts: readonly T[]): T | undefined {
  return accounts.find((candidate) => candidate.isPreferred)
    ?? (accounts.length === 1 ? accounts[0] : undefined);
}

export function deriveChannel(accounts: readonly ChannelAccount[]): PaymentChannel {
  const account = selectChannelAccount(accounts);
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
