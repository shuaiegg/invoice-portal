import test from "node:test";
import assert from "node:assert/strict";
import { runPostSignupTasks } from "../lib/signup-after.ts";

test("claim failure is reported but does not reject signup", async () => {
  const calls: string[] = [];
  await runPostSignupTasks({
    claimWorker: async () => { calls.push("claim"); throw new Error("database unavailable"); },
    reportClaimError: () => { calls.push("reported"); },
  });
  assert.deepEqual(calls, ["claim", "reported"]);
});

test("successful claim reports nothing", async () => {
  const calls: string[] = [];
  await runPostSignupTasks({
    claimWorker: async () => { calls.push("claim"); },
    reportClaimError: () => { calls.push("reported"); },
  });
  assert.deepEqual(calls, ["claim"]);
});
