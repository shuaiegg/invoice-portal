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

test("admin can return a submitted invoice to the worker for changes", () => {
  assert.equal(isAdminInvoiceTransitionAllowed("SUBMITTED", "DRAFT"), true);
});

test("locked invoices cannot be returned to draft", () => {
  assert.equal(isAdminInvoiceTransitionAllowed("APPROVED", "DRAFT"), false);
  assert.equal(isAdminInvoiceTransitionAllowed("PAID", "DRAFT"), false);
});
