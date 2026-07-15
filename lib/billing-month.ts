export function deriveBillingMonth(invoiceDate: Date, serviceDate?: Date | null): string {
  // Worker invoices carry an explicit serviceDate; use it as the service-period source.
  // Older/partial submissions fall back to the invoice date, always using its UTC month.
  const source = serviceDate ?? invoiceDate;
  return `${source.getUTCFullYear()}-${String(source.getUTCMonth() + 1).padStart(2, "0")}`;
}
