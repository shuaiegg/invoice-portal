import test from "node:test";
import assert from "node:assert/strict";
import { deriveChannel, filterWorkerIdsByChannel } from "../lib/payment-channel.ts";

test("preferred account wins over other accounts", () => {
  assert.equal(
    deriveChannel([
      { type: "WISE", isPreferred: false },
      { type: "PAYPAL", isPreferred: true },
    ]),
    "PAYPAL",
  );
});

test("single non-preferred account is used as fallback", () => {
  assert.equal(deriveChannel([{ type: "WISE", isPreferred: false }]), "WISE");
});

test("no accounts derives Manual", () => {
  assert.equal(deriveChannel([]), "MANUAL");
});

for (const type of ["CRYPTO", "REVOLUT", "BANK_TRANSFER", "OTHER"] as const) {
  test(`${type} folds into Manual`, () => {
    assert.equal(deriveChannel([{ type, isPreferred: true }]), "MANUAL");
  });
}

test("channel filtering returns matching worker IDs", () => {
  const channels = new Map([
    ["wise-worker", "WISE"],
    ["manual-worker", "MANUAL"],
  ] as const);
  assert.deepEqual(filterWorkerIdsByChannel(channels, "WISE"), ["wise-worker"]);
});
