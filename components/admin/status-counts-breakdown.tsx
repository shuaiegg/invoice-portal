import type { InvoiceStatus } from "@/lib/generated/client/client";

// Same head+dot-list layout as CurrencyTotalsBreakdown, so the two stat
// cards read as one visual system: bold headline, muted label + colored
// identity dot per row below.
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PAID: "Paid",
  VOID: "Void",
};
const STATUS_DOT_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#00a0ff",
  APPROVED: "#2a78d6",
  PAID: "#22c55e",
  VOID: "#ef4444",
};
const STATUS_ORDER: InvoiceStatus[] = ["SUBMITTED", "APPROVED", "PAID", "DRAFT", "VOID"];

export function StatusCountsBreakdown({ counts }: { counts: Partial<Record<InvoiceStatus, number>> }) {
  const [headStatus, ...restStatuses] = STATUS_ORDER;
  const headCount = counts[headStatus] ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xl font-semibold whitespace-nowrap">{headCount}</p>
      <div className="flex flex-col gap-1">
        {restStatuses.map((status) => (
          <div key={status} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
            />
            <span className="w-16 text-muted-foreground">{STATUS_LABELS[status]}</span>
            <span className="tabular-nums">{counts[status] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
