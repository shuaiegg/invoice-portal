import test from "node:test";
import assert from "node:assert/strict";
import { deriveBillingMonth, resolveInvoiceSlot } from "../lib/billing-month.ts";

test("deriveBillingMonth uses the service date for a later submission", () => {
  assert.equal(
    deriveBillingMonth(new Date("2026-07-03T12:00:00.000Z"), new Date("2026-06-30T00:00:00.000Z")),
    "2026-06",
  );
});

test("deriveBillingMonth falls back to the invoice date UTC month", () => {
  assert.equal(deriveBillingMonth(new Date("2026-07-01T00:30:00.000Z"), null), "2026-07");
});

test("first invoice of a month takes the primary slot", () => {
  assert.deepEqual(resolveInvoiceSlot([]), { supplementNo: 0 });
});

test("an editable primary blocks a second invoice for the month", () => {
  assert.deepEqual(resolveInvoiceSlot([{ status: "SUBMITTED", supplementNo: 0 }]), { conflict: "editable-primary" });
  assert.deepEqual(resolveInvoiceSlot([{ status: "DRAFT", supplementNo: 0 }]), { conflict: "editable-primary" });
});

test("a locked primary yields the next supplement number", () => {
  assert.deepEqual(resolveInvoiceSlot([{ status: "PAID", supplementNo: 0 }]), { supplementNo: 1 });
  assert.deepEqual(
    resolveInvoiceSlot([
      { status: "PAID", supplementNo: 0 },
      { status: "APPROVED", supplementNo: 1 },
      { status: "SUBMITTED", supplementNo: 2 },
    ]),
    { supplementNo: 3 },
  );
});

test("supplements without a primary leave the primary slot open for TD sync", () => {
  assert.deepEqual(resolveInvoiceSlot([{ status: "PAID", supplementNo: 1 }]), { supplementNo: 0 });
});
