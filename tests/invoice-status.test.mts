import test from "node:test";
import assert from "node:assert/strict";
import { isAdminInvoiceTransitionAllowed, isWorkerInvoiceEditable } from "../lib/invoice-status.ts";

test("workers can edit draft and submitted invoices only", () => {
  assert.equal(isWorkerInvoiceEditable("DRAFT"), true);
  assert.equal(isWorkerInvoiceEditable("SUBMITTED"), true);
  assert.equal(isWorkerInvoiceEditable("APPROVED"), false);
});

test("admin can void a draft invoice", () => {
  assert.equal(isAdminInvoiceTransitionAllowed("DRAFT", "VOID"), true);
});

test("admin can advance a draft invoice to submitted", () => {
  assert.equal(isAdminInvoiceTransitionAllowed("DRAFT", "SUBMITTED"), true);
});
