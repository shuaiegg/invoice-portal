import test from "node:test";
import assert from "node:assert/strict";
import { channelFromTdMethod, deriveChannel, filterWorkerIdsByChannel, selectChannelAccount } from "../lib/payment-channel.ts";

test("TD payroll payment method is the channel authority, overriding preferred accounts", () => {
  assert.equal(
    deriveChannel({
      paymentMethod: "Manual",
      paymentAccounts: [{ type: "WISE", isPreferred: true }],
    }),
    "MANUAL",
  );
  assert.equal(
    deriveChannel({ paymentMethod: "Wise", paymentAccounts: [] }),
    "WISE",
  );
  assert.equal(
    deriveChannel({ paymentMethod: "PayPal", paymentAccounts: [{ type: "WISE", isPreferred: true }] }),
    "PAYPAL",
  );
});

test("TD method strings normalize case-insensitively; unknown rails fold to Manual", () => {
  assert.equal(channelFromTdMethod("wise"), "WISE");
  assert.equal(channelFromTdMethod("Bank transfer"), "MANUAL");
  assert.equal(channelFromTdMethod("  "), null);
  assert.equal(channelFromTdMethod(null), null);
});

test("without a TD method, the preferred account wins", () => {
  assert.equal(
    deriveChannel({
      paymentMethod: null,
      paymentAccounts: [
        { type: "WISE", isPreferred: false },
        { type: "PAYPAL", isPreferred: true },
      ],
    }),
    "PAYPAL",
  );
});

test("without a TD method, a single non-preferred account is the fallback", () => {
  assert.equal(deriveChannel({ paymentAccounts: [{ type: "WISE", isPreferred: false }] }), "WISE");
});

test("no TD method and no accounts derives Manual", () => {
  assert.equal(deriveChannel({ paymentMethod: undefined, paymentAccounts: [] }), "MANUAL");
});

for (const type of ["CRYPTO", "REVOLUT", "BANK_TRANSFER", "OTHER"] as const) {
  test(`${type} account folds into Manual`, () => {
    assert.equal(deriveChannel({ paymentAccounts: [{ type, isPreferred: true }] }), "MANUAL");
  });
}

test("selectChannelAccount prefers the account matching the channel's rail", () => {
  const accounts = [
    { type: "PAYPAL", isPreferred: true },
    { type: "WISE", isPreferred: false },
  ];
  assert.equal(selectChannelAccount(accounts, "WISE")?.type, "WISE");
  assert.equal(selectChannelAccount(accounts, "PAYPAL")?.type, "PAYPAL");
  // No rail match for the channel → preferred-or-single fallback
  assert.equal(selectChannelAccount([{ type: "PAYPAL", isPreferred: true }], "WISE")?.type, "PAYPAL");
  assert.equal(selectChannelAccount(accounts)?.type, "PAYPAL");
});

test("channel filtering returns matching worker IDs", () => {
  const channels = new Map([
    ["wise-worker", "WISE"],
    ["manual-worker", "MANUAL"],
  ] as const);
  assert.deepEqual(filterWorkerIdsByChannel(channels, "WISE"), ["wise-worker"]);
});
