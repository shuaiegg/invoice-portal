import test from "node:test";
import assert from "node:assert/strict";

import {
  createPaymentAccountForWorker,
  setPreferredPaymentAccountForWorker,
} from "../lib/payment-account-actions.ts";

test("createPaymentAccountForWorker returns 422 details for missing type-specific fields", async () => {
  const db = {
    paymentAccount: {
      create: async () => {
        throw new Error("create should not be called");
      },
    },
  };

  const result = await createPaymentAccountForWorker(db, "worker-1", {
    type: "CRYPTO",
    cryptoCoin: "USDT",
  });

  assert.equal(result.status, 422);
  assert.deepEqual(result.body, {
    error: "Missing required field(s): cryptoNetwork, cryptoWallet",
    fields: ["cryptoNetwork", "cryptoWallet"],
  });
});

test("setPreferredPaymentAccountForWorker clears existing preferred accounts in one transaction", async () => {
  const calls: string[] = [];
  const db = {
    $transaction: async (operations: unknown[]) => {
      calls.push(`transaction:${operations.length}`);
      return operations;
    },
    paymentAccount: {
      findUnique: async () => ({ id: "account-b", workerId: "worker-1" }),
      updateMany: (args: unknown) => {
        calls.push(`updateMany:${JSON.stringify(args)}`);
        return { count: 1 };
      },
      update: (args: unknown) => {
        calls.push(`update:${JSON.stringify(args)}`);
        return { id: "account-b", workerId: "worker-1", isPreferred: true };
      },
    },
  };

  const result = await setPreferredPaymentAccountForWorker(db, "worker-1", "account-b");

  assert.equal(result.status, 200);
  assert.equal(calls.at(-1), "transaction:2");
  assert.match(calls[0], /"workerId":"worker-1"/);
  assert.match(calls[1], /"id":"account-b"/);
  assert.match(calls[1], /"workerId":"worker-1"/);
});

test("setPreferredPaymentAccountForWorker returns 403 for another worker's account", async () => {
  const db = {
    $transaction: async () => {
      throw new Error("transaction should not be called");
    },
    paymentAccount: {
      findUnique: async () => ({ id: "account-b", workerId: "worker-2" }),
      updateMany: () => {
        throw new Error("updateMany should not be called");
      },
      update: () => {
        throw new Error("update should not be called");
      },
    },
  };

  const result = await setPreferredPaymentAccountForWorker(db, "worker-1", "account-b");

  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Forbidden" });
});
