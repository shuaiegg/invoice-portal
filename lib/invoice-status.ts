import type { InvoiceStatus } from "./generated/client/enums";

export function isWorkerInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "DRAFT" || status === "SUBMITTED";
}

export function isAdminInvoiceTransitionAllowed(current: InvoiceStatus, next: InvoiceStatus): boolean {
  return next === "VOID"
    || (current === "DRAFT" && next === "SUBMITTED")
    || (current === "SUBMITTED" && next === "APPROVED")
    || (current === "APPROVED" && next === "PAID");
}
