import { PaymentType } from "@/lib/generated/client/enums";

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  TD_ONLY: "TD Only",
  TD_PLUS: "TD Plus",
  MANUAL: "Manual",
};

export function parsePaymentType(value: unknown): PaymentType | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().replace(/-/g, "_").toUpperCase();
  if (normalized === PaymentType.TD_ONLY || normalized === PaymentType.TD_PLUS || normalized === PaymentType.MANUAL) {
    return normalized;
  }

  return undefined;
}

export function isValidPaymentType(value: unknown): boolean {
  return parsePaymentType(value) !== undefined;
}
