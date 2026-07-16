import type { InvoiceStatus } from "./generated/client/enums";

export function isWorkerInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "DRAFT" || status === "SUBMITTED";
}

export function isAdminInvoiceTransitionAllowed(current: InvoiceStatus, next: InvoiceStatus): boolean {
  return next === "VOID"
    || (current === "DRAFT" && next === "SUBMITTED")
    || (current === "SUBMITTED" && next === "APPROVED")
    // Request changes: hand the invoice back to the worker; it drops out of
    // approve-ready sets and resubmission flips it back to SUBMITTED.
    || (current === "SUBMITTED" && next === "DRAFT")
    || (current === "APPROVED" && next === "PAID");
}
