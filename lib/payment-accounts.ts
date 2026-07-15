export const PAYMENT_ACCOUNT_TYPES = [
  "BANK_TRANSFER",
  "WISE",
  "PAYPAL",
  "CRYPTO",
  "REVOLUT",
  "OTHER",
] as const;

export type PaymentAccountType = (typeof PAYMENT_ACCOUNT_TYPES)[number];

export type PaymentAccountInput = {
  type?: unknown;
  label?: unknown;
  accountNumber?: unknown;
  bankName?: unknown;
  swiftCode?: unknown;
  email?: unknown;
  cryptoCoin?: unknown;
  cryptoNetwork?: unknown;
  cryptoWallet?: unknown;
  notes?: unknown;
};

export type NormalizedPaymentAccountInput = {
  type: PaymentAccountType;
  label: string | null;
  accountNumber: string | null;
  bankName: string | null;
  swiftCode: string | null;
  email: string | null;
  cryptoCoin: string | null;
  cryptoNetwork: string | null;
  cryptoWallet: string | null;
  notes: string | null;
};

type PaymentAccountSummary = {
  type: PaymentAccountType | string;
  label?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  email?: string | null;
  cryptoCoin?: string | null;
  cryptoNetwork?: string | null;
  cryptoWallet?: string | null;
  notes?: string | null;
};

export const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  BANK_TRANSFER: "Bank Transfer",
  WISE: "Wise",
  PAYPAL: "PayPal",
  CRYPTO: "Crypto",
  REVOLUT: "Revolut",
  OTHER: "Other",
};

import { optionalString } from "./utils.ts";

export function isPaymentAccountType(value: unknown): value is PaymentAccountType {
  return typeof value === "string" && PAYMENT_ACCOUNT_TYPES.includes(value as PaymentAccountType);
}

export function normalizePaymentAccountInput(input: PaymentAccountInput): NormalizedPaymentAccountInput {
  const type = isPaymentAccountType(input.type) ? input.type : "BANK_TRANSFER";

  return {
    type,
    label: optionalString(input.label),
    accountNumber: type === "BANK_TRANSFER" ? optionalString(input.accountNumber) : null,
    bankName: type === "BANK_TRANSFER" ? optionalString(input.bankName) : null,
    swiftCode: type === "BANK_TRANSFER" ? optionalString(input.swiftCode) : null,
    email: type === "WISE" || type === "PAYPAL" || type === "REVOLUT" ? optionalString(input.email) : null,
    cryptoCoin: type === "CRYPTO" ? optionalString(input.cryptoCoin) : null,
    cryptoNetwork: type === "CRYPTO" ? optionalString(input.cryptoNetwork) : null,
    cryptoWallet: type === "CRYPTO" ? optionalString(input.cryptoWallet) : null,
    notes: optionalString(input.notes),
  };
}

export function validatePaymentAccountInput(input: PaymentAccountInput): string[] {
  if (!isPaymentAccountType(input.type)) {
    return ["type"];
  }

  const data = normalizePaymentAccountInput(input);

  switch (data.type) {
    case "BANK_TRANSFER":
      return data.accountNumber ? [] : ["accountNumber"];
    case "WISE":
    case "PAYPAL":
    case "REVOLUT":
      return data.email ? [] : ["email"];
    case "CRYPTO":
      return [
        ["cryptoCoin", data.cryptoCoin],
        ["cryptoNetwork", data.cryptoNetwork],
        ["cryptoWallet", data.cryptoWallet],
      ]
        .filter(([, value]) => !value)
        .map(([field]) => field as string);
    case "OTHER":
      return [];
  }
}

export function formatPaymentAccountKeyDetail(account: PaymentAccountSummary): string {
  switch (account.type) {
    case "BANK_TRANSFER":
      return [account.bankName, account.accountNumber].filter(Boolean).join(" - ") || "Bank account";
    case "WISE":
    case "PAYPAL":
    case "REVOLUT":
      return account.email || "Email not set";
    case "CRYPTO":
      return [account.cryptoCoin, account.cryptoNetwork].filter(Boolean).join(" on ")
        + (account.cryptoWallet ? ` - ${account.cryptoWallet}` : "");
    case "OTHER":
      return account.notes || account.label || "See payment notes";
    default:
      return "Payment account";
  }
}
