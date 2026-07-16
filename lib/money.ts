export type CurrencyTotals = Record<string, number>;

export function formatAmount(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyTotals(totals: CurrencyTotals, locale = "en-US"): string {
  return Object.entries(totals)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatAmount(amount, currency, locale))
    .join(" + ");
}

export function currencyTotalsFromGroups(
  groups: Array<{ currency: string; _sum: { totalAmount: number | null } }>,
): CurrencyTotals {
  return Object.fromEntries(groups.map((group) => [group.currency, group._sum.totalAmount ?? 0]));
}
