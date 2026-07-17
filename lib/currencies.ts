// Currencies actually in use across the worker base today (EUR 213, USD 28, INR 12, PHP 8 as of
// 2026-07). A fixed list, not free text, since this feeds Xero bills directly — see
// openspec/changes/td-sync-worker-onboarding design.md R3.
export const ACTIVE_CURRENCIES = ["EUR", "USD", "INR", "PHP"] as const;
export type ActiveCurrency = (typeof ACTIVE_CURRENCIES)[number];

export function isActiveCurrency(value: unknown): value is ActiveCurrency {
  return typeof value === "string" && (ACTIVE_CURRENCIES as readonly string[]).includes(value);
}
