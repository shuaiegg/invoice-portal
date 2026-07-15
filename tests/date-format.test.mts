import test from "node:test";
import assert from "node:assert/strict";
import { formatParisDateTime } from "../lib/date-format.ts";

test("formatParisDateTime uses Europe/Paris daylight-saving time", () => {
  const result = formatParisDateTime("2026-07-13T12:00:00.000Z", "en-GB");
  assert.match(result, /14:00/);
});
