import test from "node:test";
import assert from "node:assert/strict";
import { runPostSignupTasks } from "../lib/signup-after.ts";

test("claim failure does not prevent first-admin assignment or reject signup", async () => {
  const calls: string[] = [];
  await runPostSignupTasks({
    assignFirstAdmin: async () => { calls.push("admin"); },
    claimWorker: async () => { calls.push("claim"); throw new Error("database unavailable"); },
    reportClaimError: () => { calls.push("reported"); },
  });
  assert.deepEqual(calls, ["admin", "claim", "reported"]);
});
