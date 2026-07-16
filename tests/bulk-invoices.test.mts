import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBulkInvoiceWhere,
  findPaymentIncomplete,
  runGuardedTransitions,
} from "../lib/bulk-invoices.ts";

test("filter-scoped resolution builds billing month, worker name, status and channel constraints", () => {
  assert.deepEqual(
    buildBulkInvoiceWhere(
      { billingMonth: "2026-06", workerName: "Ada", status: ["SUBMITTED"] },
      ["wise-worker"],
    ),
    {
      billingMonth: "2026-06",
      status: { in: ["SUBMITTED"] },
      worker: { name: { contains: "Ada", mode: "insensitive" } },
      workerId: { in: ["wise-worker"] },
    },
  );
});

test("mixed statuses and a concurrent status race are skipped without corruption", async () => {
  const batches: string[][] = [];
  const result = await runGuardedTransitions(
    [
      { id: "submitted", status: "SUBMITTED" },
      { id: "already-approved", status: "APPROVED" },
      { id: "raced", status: "SUBMITTED" },
    ],
    "APPROVE",
    // The batch applier receives only eligible rows; "raced" was flipped by a
    // concurrent request between resolve and update, so the guarded UPDATE
    // doesn't transition it and it is reported as skipped.
    async (ids) => {
      batches.push(ids);
      return ids.filter((id) => id !== "raced");
    },
  );

  assert.deepEqual(batches, [["submitted", "raced"]]);
  assert.deepEqual(result, { transitionedIds: ["submitted"], skippedWrongStatus: 2 });
});

test("no eligible rows never calls the batch applier", async () => {
  const result = await runGuardedTransitions(
    [{ id: "paid", status: "PAID" }],
    "APPROVE",
    async () => {
      throw new Error("should not be called");
    },
  );
  assert.deepEqual(result, { transitionedIds: [], skippedWrongStatus: 1 });
});

test("dry-run payment pre-check flags only workers with no payment trail at all", () => {
  const incomplete = findPaymentIncomplete([
    {
      // Wise account without email: NOT flagged — pre-phase3 payouts run through
      // TD/Wise export files, so a missing email must not block approval
      worker: {
        id: "wise",
        name: "Wise Worker",
        paymentMethod: "Wise",
        paymentAccounts: [{ type: "WISE", isPreferred: true, email: null }],
      },
    },
    {
      // TD payment method on record but no accounts: NOT flagged
      worker: {
        id: "td-manual",
        name: "TD Manual Worker",
        paymentMethod: "Manual",
        paymentAccounts: [],
      },
    },
    {
      // Nothing at all: flagged
      worker: {
        id: "bare",
        name: "Bare Worker",
        paymentMethod: null,
        paymentAccounts: [],
      },
    },
  ]);

  assert.deepEqual(incomplete.map((item) => [item.workerId, item.channel, item.missing]), [
    ["bare", "MANUAL", ["payment account"]],
  ]);
});
