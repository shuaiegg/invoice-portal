import { acquireWorkerProvisioningLockBlocking, type LockableTransaction } from "./worker-provisioning.ts";

type WorkerClaimTx = LockableTransaction & {
  worker: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

type WorkerClaimDb = {
  $transaction<T>(fn: (tx: WorkerClaimTx) => Promise<T>): Promise<T>;
};

export async function claimPreprovisionedWorker(
  db: WorkerClaimDb,
  user: { id: string; email: string },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // Blocking, not try-lock: this runs on every sign-up, so it briefly waits out any concurrent
    // admin worker-creation action instead of failing the user's registration outright — see
    // lib/worker-provisioning.ts for why this must share a lock with CSV import / failure
    // resolution / manual worker creation (design.md R1 — a resolve-driven Worker.create racing
    // a real self-registration for the same email).
    await acquireWorkerProvisioningLockBlocking(tx);

    const worker = await tx.worker.findFirst({
      where: {
        userId: null,
        timeDoctorEmail: { equals: user.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!worker) return false;

    const result = await tx.worker.updateMany({
      where: { id: worker.id, userId: null },
      data: { userId: user.id },
    });
    return result.count === 1;
  });
}
