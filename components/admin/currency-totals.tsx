import { formatAmount, type CurrencyTotals } from "@/lib/money";

// Fixed identity colors per currency (validated categorical slots — see dataviz
// palette). Color follows the entity: a currency keeps its dot everywhere, and the
// code label beside the dot always carries identity, never the color alone.
const CURRENCY_DOT_COLORS: Record<string, string> = {
  EUR: "#2a78d6",
  USD: "#008300",
  INR: "#eda100",
  PHP: "#4a3aa7",
};
const FALLBACK_DOT_COLOR = "#6b7280";

export function CurrencyTotalsBreakdown({ totals }: { totals: CurrencyTotals }) {
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return <p className="text-2xl font-semibold">—</p>;

  const [[headCurrency, headAmount], ...rest] = entries;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xl font-semibold whitespace-nowrap">{formatAmount(headAmount, headCurrency)}</p>
      {rest.length > 0 ? (
        <div className="flex flex-col gap-1">
          {rest.map(([currency, amount]) => (
            <div key={currency} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: CURRENCY_DOT_COLORS[currency] ?? FALLBACK_DOT_COLOR }}
              />
              <span className="w-9 text-muted-foreground">{currency}</span>
              <span className="tabular-nums">{formatAmount(amount, currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
