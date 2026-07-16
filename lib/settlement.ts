export function previousParisBillingMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isSettlementComplete(
  statusCounts: Partial<Record<"DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "VOID", number>>,
  unresolvedFailures: number,
): boolean {
  const nonVoid = (statusCounts.DRAFT ?? 0)
    + (statusCounts.SUBMITTED ?? 0)
    + (statusCounts.APPROVED ?? 0)
    + (statusCounts.PAID ?? 0);
  // A month with no invoices hasn't been settled — it just hasn't started
  return nonVoid > 0 && nonVoid === (statusCounts.PAID ?? 0) && unresolvedFailures === 0;
}
