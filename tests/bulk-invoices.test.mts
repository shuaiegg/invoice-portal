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
  const updates: string[] = [];
  const result = await runGuardedTransitions(
    [
      { id: "submitted", status: "SUBMITTED" },
      { id: "already-approved", status: "APPROVED" },
      { id: "raced", status: "SUBMITTED" },
    ],
    "APPROVE",
    async (id) => {
      if (id === "raced") return false;
      updates.push(id);
      return true;
    },
  );

  assert.deepEqual(updates, ["submitted"]);
  assert.deepEqual(result, { transitionedIds: ["submitted"], skippedWrongStatus: 2 });
});

test("dry-run payment pre-check flags missing Wise and PayPal emails", () => {
  const incomplete = findPaymentIncomplete([
    {
      worker: {
        id: "wise",
        name: "Wise Worker",
        paymentAccounts: [{ type: "WISE", isPreferred: true, email: null }],
      },
    },
    {
      worker: {
        id: "paypal",
        name: "PayPal Worker",
        paymentAccounts: [{ type: "PAYPAL", isPreferred: true, email: "" }],
      },
    },
  ]);

  assert.deepEqual(incomplete.map((item) => [item.workerId, item.channel, item.missing]), [
    ["wise", "WISE", ["email"]],
    ["paypal", "PAYPAL", ["email"]],
  ]);
});
