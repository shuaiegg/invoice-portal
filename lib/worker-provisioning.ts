import type { Prisma } from "./generated/client/client";
import type { PaymentAccountType, PaymentType, HourlyRateSource } from "./generated/client/enums";

// Narrow, structural type (not the full Prisma.TransactionClient) so callers — including tests —
// can pass a lightweight mock rather than a real transaction client. Same DI pattern used
// elsewhere in this codebase (see lib/worker-claim.ts, lib/payment-account-actions.ts).
export type LockableTransaction = {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

// Every worker-creation path (CSV import, TD sync failure resolution, manual admin add) must
// serialize against each other so two of them can't both decide "no existing worker for this
// email" and create duplicate rows. Non-blocking: an admin action should fail fast and let the
// admin retry rather than hang, since another admin action holding the lock is expected to be
// a short-lived transaction, not something worth a long wait.
export async function acquireWorkerProvisioningLock(tx: LockableTransaction): Promise<void> {
  const rows = (await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext('worker-import')) AS locked`) as { locked: boolean }[];
  if (!rows[0]?.locked) {
    throw new Error("Another worker-creation operation is already running. Please wait for it to finish before trying again.");
  }
}

// Sign-up's claim step (lib/worker-claim.ts) uses the blocking variant instead: unlike an admin
// action, a worker's own registration shouldn't fail outright just because an admin happens to be
// mid-resolve at that exact moment — it should briefly wait for the same lock, then proceed with
// up-to-date data. This is what makes the sign-up-vs-resolve race in design.md (R1) safe: whichever
// side commits first is guaranteed visible to the other before it acts.
export async function acquireWorkerProvisioningLockBlocking(tx: LockableTransaction): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('worker-import'))`;
}

export type ProvisionWorkerFields = {
  name: string;
  timeDoctorEmail?: string | null;
  team?: string | null;
  hourlyRate: number;
  hourlyRateSource: HourlyRateSource;
  currency: string;
  paymentType: PaymentType;
  paymentMethod?: string | null;
  accountType?: PaymentAccountType | null;
  accountEmail?: string | null;
  // Defaults to `Time Doctor ${paymentMethod}` (matches CSV import's existing labeling) when
  // omitted — pass explicitly for admin-driven creation, where "Time Doctor" as a prefix would
  // be misleading since the account details didn't come from a TD import.
  accountLabel?: string | null;
  // Admin user id for an admin-driven edit; null for a bulk CSV import (matches the existing
  // convention on Worker.hourlyRateUpdatedBy).
  configuredBy: string | null;
};

// Creates or updates a Worker's payment configuration (rate, currency, paymentType, payment
// account) and marks it paymentConfigured — the single write path shared by CSV import, TD sync
// failure resolution, and manual admin worker creation. Must be called after
// acquireWorkerProvisioningLock (or ...Blocking) in the same transaction.
export async function provisionWorker(
  tx: Prisma.TransactionClient,
  existingWorkerId: string | null,
  fields: ProvisionWorkerFields,
): Promise<{ workerId: string; created: boolean }> {
  const data = {
    name: fields.name,
    ...(fields.timeDoctorEmail !== undefined ? { timeDoctorEmail: fields.timeDoctorEmail } : {}),
    ...(fields.team ? { team: fields.team } : {}),
    hourlyRate: fields.hourlyRate,
    hourlyRateSource: fields.hourlyRateSource,
    hourlyRateUpdatedAt: new Date(),
    hourlyRateUpdatedBy: fields.configuredBy,
    currency: fields.currency,
    paymentType: fields.paymentType,
    paymentConfigured: true,
    ...(fields.paymentMethod !== undefined ? { paymentMethod: fields.paymentMethod } : {}),
  };

  let workerId = existingWorkerId;
  let created = false;
  if (workerId) {
    await tx.worker.update({ where: { id: workerId }, data });
  } else {
    const worker = await tx.worker.create({ data: { userId: null, ...data } });
    workerId = worker.id;
    created = true;
  }

  if (fields.accountType) {
    const existingAccount = await tx.paymentAccount.findFirst({ where: { workerId, type: fields.accountType } });
    if (existingAccount) {
      await tx.paymentAccount.update({
        where: { id: existingAccount.id },
        data: { email: fields.accountEmail ?? existingAccount.email },
      });
    } else {
      await tx.paymentAccount.create({
        data: {
          workerId,
          type: fields.accountType,
          email: fields.accountEmail ?? null,
          label: fields.accountLabel ?? (fields.paymentMethod ? `Time Doctor ${fields.paymentMethod}` : fields.accountType),
          isPreferred: created,
        },
      });
    }
  }

  return { workerId, created };
}
