import test from "node:test";
import assert from "node:assert/strict";
import { buildTdWorkerMatcher } from "../lib/td-worker-matching.ts";

const workers = [
  { id: "pending", timeDoctorEmail: "pending@example.com", user: null },
  { id: "fallback", timeDoctorEmail: null, user: { email: "fallback@example.com", active: true } },
  { id: "preferred", timeDoctorEmail: "shared@example.com", user: null },
  { id: "wrong-fallback", timeDoctorEmail: null, user: { email: "shared@example.com", active: true } },
  { id: "inactive", timeDoctorEmail: "inactive@example.com", user: { email: "inactive@example.com", active: false } },
];

test("pre-provisioned worker without a User is eligible for TD matching", () => {
  assert.deepEqual(buildTdWorkerMatcher(workers).match("PENDING@example.com"), { kind: "matched", worker: workers[0] });
});

test("a self-registered worker with no timeDoctorEmail is still found via their login email", () => {
  // This is the exact real-world case that broke: a worker who registered normally (no
  // timeDoctorEmail ever set) must be matched by their login email, or every CSV import
  // creates a fresh duplicate pending worker instead of updating the real one.
  assert.deepEqual(buildTdWorkerMatcher(workers).match("fallback@example.com"), { kind: "matched", worker: workers[1] });
});

test("timeDoctorEmail is preferred over login email fallback", () => {
  assert.deepEqual(buildTdWorkerMatcher(workers).match("shared@example.com"), { kind: "matched", worker: workers[2] });
});

test("deactivated users are classified separately", () => {
  assert.deepEqual(buildTdWorkerMatcher(workers).match("inactive@example.com"), { kind: "inactive" });
});
