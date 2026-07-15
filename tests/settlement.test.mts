import test from "node:test";
import assert from "node:assert/strict";
import { isSettlementComplete, previousParisBillingMonth } from "../lib/settlement.ts";

test("previous settlement month is based on Europe/Paris", () => {
  assert.equal(previousParisBillingMonth(new Date("2026-08-02T22:30:00.000Z")), "2026-07");
});

test("settlement is complete only when every non-void invoice is paid and failures are resolved", () => {
  assert.equal(isSettlementComplete({ PAID: 10, VOID: 2 }, 0), true);
  assert.equal(isSettlementComplete({ PAID: 10, APPROVED: 1, VOID: 2 }, 0), false);
  assert.equal(isSettlementComplete({ PAID: 10, VOID: 2 }, 1), false);
});
