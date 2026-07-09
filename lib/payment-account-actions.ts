import {
  normalizePaymentAccountInput,
  type PaymentAccountInput,
  validatePaymentAccountInput,
} from "./payment-accounts.ts";
import { db } from "./db";

type ActionResult = {
  status: number;
  body: unknown;
};

function missingFieldsResult(fields: string[]): ActionResult | null {
  if (fields.length === 0) return null;

  return {
    status: 422,
    body: {
      error: `Missing required field(s): ${fields.join(", ")}`,
      fields,
    },
  };
}

async function findOwnedAccount(workerId: string, accountId: string): Promise<ActionResult | null> {
  const account = await db.paymentAccount.findUnique({
    where: { id: accountId },
    select: { id: true, workerId: true, isPreferred: true },
  });

  if (!account) {
    return { status: 404, body: { error: "Payment account not found" } };
  }

  if (account.workerId !== workerId) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  return null;
}

export async function listPaymentAccountsForWorker(workerId: string): Promise<ActionResult> {
  const accounts = await db.paymentAccount.findMany({
    where: { workerId },
    orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
  });

  return { status: 200, body: accounts };
}

export async function createPaymentAccountForWorker(
  workerId: string,
  input: PaymentAccountInput
): Promise<ActionResult> {
  const validation = missingFieldsResult(validatePaymentAccountInput(input));
  if (validation) return validation;

  const account = await db.paymentAccount.create({
    data: {
      ...normalizePaymentAccountInput(input),
      workerId,
      isPreferred: false,
    },
  });

  return { status: 201, body: account };
}

export async function updatePaymentAccountForWorker(
  workerId: string,
  accountId: string,
  input: PaymentAccountInput
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(workerId, accountId);
  if (ownership) return ownership;

  const validation = missingFieldsResult(validatePaymentAccountInput(input));
  if (validation) return validation;

  const account = await db.paymentAccount.update({
    where: { id: accountId },
    data: normalizePaymentAccountInput(input),
  });

  return { status: 200, body: account };
}

export async function deletePaymentAccountForWorker(
  workerId: string,
  accountId: string
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(workerId, accountId);
  if (ownership) return ownership;

  await db.paymentAccount.delete({ where: { id: accountId } });

  return { status: 200, body: { success: true } };
}

export async function setPreferredPaymentAccountForWorker(
  workerId: string,
  accountId: string
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(workerId, accountId);
  if (ownership) return ownership;

  const [, updated] = await db.$transaction([
    db.paymentAccount.updateMany({
      where: { workerId, isPreferred: true, NOT: { id: accountId } },
      data: { isPreferred: false },
    }),
    db.paymentAccount.update({
      where: { id: accountId },
      data: { isPreferred: true },
    }),
  ]);

  return { status: 200, body: updated };
}
