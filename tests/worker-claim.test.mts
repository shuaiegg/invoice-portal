import test from "node:test";
import assert from "node:assert/strict";
import { claimPreprovisionedWorker } from "../lib/worker-claim.ts";

test("claimPreprovisionedWorker links an unclaimed case-insensitive TD email match", async () => {
  const calls: unknown[] = [];
  const tx = {
    $queryRaw: async () => [],
    worker: {
      findFirst: async (args: unknown) => {
        calls.push(args);
        return { id: "worker-1" };
      },
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 1 };
      },
    },
  };
  const db = { $transaction: <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx) };

  assert.equal(await claimPreprovisionedWorker(db, { id: "user-1", email: "Jane@Example.com" }), true);
  assert.match(JSON.stringify(calls[0]), /"mode":"insensitive"/);
  assert.match(JSON.stringify(calls[1]), /"userId":"user-1"/);
});

test("claimPreprovisionedWorker does nothing without a match", async () => {
  const tx = {
    $queryRaw: async () => [],
    worker: {
      findFirst: async () => null,
      updateMany: async () => { throw new Error("must not update"); },
    },
  };
  const db = { $transaction: <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx) };
  assert.equal(await claimPreprovisionedWorker(db, { id: "user-1", email: "none@example.com" }), false);
});
