import test from "node:test";
import assert from "node:assert/strict";
import { partitionExistingWorkerIds, resolveTdSyncMonth } from "../lib/td-sync-month.ts";

test("re-running an already-synced month counts existing workers and leaves only missing workers", () => {
  const result = partitionExistingWorkerIds(
    ["worker-1", "worker-2", "worker-3"],
    new Set(["worker-1", "worker-2"]),
  );

  assert.deepEqual(result.pendingWorkerIds, ["worker-3"]);
  assert.equal(result.skippedExisting, 2);
});

test("manual sync accepts a complete past month within 24 months", () => {
  assert.deepEqual(resolveTdSyncMonth({ year: 2026, month: 4 }, new Date("2026-07-15T00:00:00Z")), {
    year: 2026,
    month: 4,
  });
});

test("manual sync rejects current, future, and older-than-24-month targets", () => {
  const now = new Date("2026-07-15T00:00:00Z");
  assert.throws(() => resolveTdSyncMonth({ year: 2026, month: 7 }, now));
  assert.throws(() => resolveTdSyncMonth({ year: 2026, month: 8 }, now));
  assert.throws(() => resolveTdSyncMonth({ year: 2024, month: 6 }, now));
});

test("manual sync defaults to the previous UTC calendar month", () => {
  assert.deepEqual(resolveTdSyncMonth(undefined, new Date("2026-01-15T00:00:00Z")), {
    year: 2025,
    month: 12,
  });
});
