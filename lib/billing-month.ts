import { isWorkerInvoiceEditable } from "./invoice-status.ts";
import type { InvoiceStatus } from "./generated/client/enums";

export function deriveBillingMonth(invoiceDate: Date, serviceDate?: Date | null): string {
  // Worker invoices carry an explicit serviceDate; use it as the service-period source.
  // Older/partial submissions fall back to the invoice date, always using its UTC month.
  const source = serviceDate ?? invoiceDate;
  return `${source.getUTCFullYear()}-${String(source.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type InvoiceSlot = { supplementNo: number } | { conflict: "editable-primary" };

// One primary invoice (supplementNo 0) per worker per billing month. While the
// primary is still editable the right move is editing it (add line items), so no
// slot is granted; once it is locked, extras become numbered supplement invoices.
export function resolveInvoiceSlot(
  existing: Array<{ status: InvoiceStatus; supplementNo: number }>,
): InvoiceSlot {
  const primary = existing.find((invoice) => invoice.supplementNo === 0);
  if (!primary) return { supplementNo: 0 };
  if (isWorkerInvoiceEditable(primary.status)) return { conflict: "editable-primary" };
  return { supplementNo: Math.max(...existing.map((invoice) => invoice.supplementNo)) + 1 };
}
