import test from "node:test";
import assert from "node:assert/strict";
import { deriveBillingMonth } from "../lib/billing-month.ts";

test("deriveBillingMonth uses the service date for a later submission", () => {
  assert.equal(
    deriveBillingMonth(new Date("2026-07-03T12:00:00.000Z"), new Date("2026-06-30T00:00:00.000Z")),
    "2026-06",
  );
});

test("deriveBillingMonth falls back to the invoice date UTC month", () => {
  assert.equal(deriveBillingMonth(new Date("2026-07-01T00:30:00.000Z"), null), "2026-07");
});
