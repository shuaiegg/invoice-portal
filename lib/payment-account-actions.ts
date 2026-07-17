import {
  normalizePaymentAccountInput,
  type PaymentAccountInput,
  validatePaymentAccountInput,
} from "./payment-accounts.ts";

type ActionResult = {
  status: number;
  body: unknown;
};

// Minimal structural db types (same DI pattern as lib/worker-claim.ts) so unit
// tests can inject mocks without a database. Route handlers pass the real
// Prisma client from lib/db.ts.
type OwnedAccountRow = { id: string; workerId: string } | null;

type FindOwnedDb = {
  paymentAccount: {
    findUnique(args: unknown): Promise<OwnedAccountRow>;
  };
};

type ListDb = {
  paymentAccount: {
    findMany(args: unknown): Promise<unknown>;
  };
};

type CreateDb = {
  paymentAccount: {
    create(args: unknown): Promise<unknown>;
  };
};

type UpdateDb = FindOwnedDb & {
  paymentAccount: FindOwnedDb["paymentAccount"] & {
    update(args: unknown): Promise<unknown>;
  };
};

type DeleteDb = FindOwnedDb & {
  paymentAccount: FindOwnedDb["paymentAccount"] & {
    delete(args: unknown): Promise<unknown>;
  };
};

type PreferDb = FindOwnedDb & {
  paymentAccount: FindOwnedDb["paymentAccount"] & {
    update(args: unknown): unknown;
    updateMany(args: unknown): unknown;
  };
  $transaction(operations: unknown[]): Promise<unknown[]>;
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

async function findOwnedAccount(
  db: FindOwnedDb,
  workerId: string,
  accountId: string,
): Promise<ActionResult | null> {
  const account = await db.paymentAccount.findUnique({
    where: { id: accountId },
    select: { id: true, workerId: true },
  });

  if (!account) {
    return { status: 404, body: { error: "Payment account not found" } };
  }

  if (account.workerId !== workerId) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  return null;
}

export async function listPaymentAccountsForWorker(db: ListDb, workerId: string): Promise<ActionResult> {
  const accounts = await db.paymentAccount.findMany({
    where: { workerId },
    orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
  });

  return { status: 200, body: accounts };
}

export async function createPaymentAccountForWorker(
  db: CreateDb,
  workerId: string,
  input: PaymentAccountInput,
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
  db: UpdateDb,
  workerId: string,
  accountId: string,
  input: PaymentAccountInput,
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(db, workerId, accountId);
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
  db: DeleteDb,
  workerId: string,
  accountId: string,
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(db, workerId, accountId);
  if (ownership) return ownership;

  await db.paymentAccount.delete({ where: { id: accountId } });

  return { status: 200, body: { success: true } };
}

export async function setPreferredPaymentAccountForWorker(
  db: PreferDb,
  workerId: string,
  accountId: string,
): Promise<ActionResult> {
  const ownership = await findOwnedAccount(db, workerId, accountId);
  if (ownership) return ownership;

  const [, updated] = await db.$transaction([
    db.paymentAccount.updateMany({
      where: { workerId, isPreferred: true, NOT: { id: accountId } },
      data: { isPreferred: false },
    }),
    db.paymentAccount.update({
      // workerId in the where scopes the mutation to the owner even if the
      // account were reassigned between the ownership check and this write.
      where: { id: accountId, workerId },
      data: { isPreferred: true },
    }),
  ]);

  return { status: 200, body: updated };
}
