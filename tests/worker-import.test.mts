import test from "node:test";
import assert from "node:assert/strict";

import {
  decideRateImport,
  isTransientConnectionError,
  parsePayrollSummaryCsv,
  paymentAccountTypeForTdMethod,
  TD_IMPORT_PAYMENT_TYPE,
  withConnectionRetry,
  WORKER_IMPORT_TRANSACTION_OPTIONS,
} from "../lib/worker-import.ts";

test("large payroll imports do not use Prisma's five-second transaction timeout", () => {
  assert.equal(WORKER_IMPORT_TRANSACTION_OPTIONS.timeout, 300_000);
});

test("parsePayrollSummaryCsv reads named columns and quoted values", () => {
  const rows = parsePayrollSummaryCsv(
    'Name,Email,Total hours,Currency,Hourly rate,Payment method\n"Doe, Jane",JANE@EXAMPLE.COM,160,usd,13.5,PayPal\n',
  );

  assert.deepEqual(rows, [{
    name: "Doe, Jane",
    email: "jane@example.com",
    currency: "USD",
    hourlyRate: 13.5,
    paymentMethod: "PayPal",
  }]);
});

test("parsePayrollSummaryCsv rejects missing required columns", () => {
  assert.throws(
    () => parsePayrollSummaryCsv("Name,Email\nJane,jane@example.com\n"),
    /Missing required CSV column: Currency/,
  );
});

test("payment method mapping leaves Manual unresolved", () => {
  assert.equal(paymentAccountTypeForTdMethod("Wise"), "WISE");
  assert.equal(paymentAccountTypeForTdMethod("PayPal"), "PAYPAL");
  assert.equal(paymentAccountTypeForTdMethod("Manual"), null);
});

test("every TD-imported worker lands on the uniform review-first draft flow", () => {
  assert.equal(TD_IMPORT_PAYMENT_TYPE, "TD_PLUS");
});

test("manual rate is reconciled only when TD catches up", () => {
  assert.equal(decideRateImport("MANUAL", 15, 15), "reconcile");
  assert.equal(decideRateImport("MANUAL", 15, 14), "conflict");
  assert.equal(decideRateImport("TD_IMPORT", 15, 14), "overwrite");
});

test("isTransientConnectionError recognizes Neon/pg connection drops but not ordinary errors", () => {
  assert.equal(isTransientConnectionError(new Error("Connection terminated unexpectedly")), true);
  assert.equal(isTransientConnectionError(new Error("ECONNRESET")), true);
  assert.equal(isTransientConnectionError(new Error("Missing required CSV column: Email")), false);
});

test("withConnectionRetry retries transient errors and gives up on non-transient ones", async () => {
  let attempts = 0;
  const result = await withConnectionRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("Connection terminated unexpectedly");
    return "ok";
  }, { retries: 3, delayMs: 1 });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);

  let calls = 0;
  await assert.rejects(
    () => withConnectionRetry(async () => {
      calls += 1;
      throw new Error("Missing required CSV column: Email");
    }, { retries: 3, delayMs: 1 }),
    /Missing required CSV column/,
  );
  assert.equal(calls, 1); // non-transient errors are not retried
});
