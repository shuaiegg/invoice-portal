import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrencyTotals } from "../lib/money.ts";

test("currency totals remain separate when currencies are mixed", () => {
  assert.equal(
    formatCurrencyTotals({ EUR: 150_300, USD: 21_800 }, "en-US"),
    "€150,300.00 + $21,800.00",
  );
});
