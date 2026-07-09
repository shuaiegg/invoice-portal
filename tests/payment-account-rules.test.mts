import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPaymentAccountKeyDetail,
  normalizePaymentAccountInput,
  validatePaymentAccountInput,
} from "../lib/payment-accounts.ts";

test("validates missing fields by payment account type", () => {
  assert.deepEqual(validatePaymentAccountInput({ type: "BANK_TRANSFER" }), ["accountNumber"]);
  assert.deepEqual(validatePaymentAccountInput({ type: "WISE" }), ["email"]);
  assert.deepEqual(validatePaymentAccountInput({ type: "PAYPAL" }), ["email"]);
  assert.deepEqual(validatePaymentAccountInput({ type: "REVOLUT" }), ["email"]);
  assert.deepEqual(validatePaymentAccountInput({ type: "CRYPTO", cryptoCoin: "USDT" }), [
    "cryptoNetwork",
    "cryptoWallet",
  ]);
});

test("normalizes a bank transfer account and clears irrelevant fields", () => {
  assert.deepEqual(
    normalizePaymentAccountInput({
      type: "BANK_TRANSFER",
      label: " Main bank ",
      accountNumber: " FR76 1234 ",
      bankName: " BNP ",
      swiftCode: " BNPAFRPP ",
      email: "worker@example.com",
      cryptoCoin: "USDT",
      cryptoNetwork: "TRC20",
      cryptoWallet: "wallet",
    }),
    {
      type: "BANK_TRANSFER",
      label: "Main bank",
      accountNumber: "FR76 1234",
      bankName: "BNP",
      swiftCode: "BNPAFRPP",
      email: null,
      cryptoCoin: null,
      cryptoNetwork: null,
      cryptoWallet: null,
    }
  );
});

test("formats concise key detail for each account type", () => {
  assert.equal(
    formatPaymentAccountKeyDetail({ type: "BANK_TRANSFER", accountNumber: "FR76", bankName: "BNP" }),
    "BNP - FR76"
  );
  assert.equal(formatPaymentAccountKeyDetail({ type: "WISE", email: "wise@example.com" }), "wise@example.com");
  assert.equal(
    formatPaymentAccountKeyDetail({
      type: "CRYPTO",
      cryptoCoin: "USDT",
      cryptoNetwork: "TRC20",
      cryptoWallet: "T123",
    }),
    "USDT on TRC20 - T123"
  );
});
