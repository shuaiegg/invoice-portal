type WorkerClaimDb = {
  worker: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

export async function claimPreprovisionedWorker(
  db: WorkerClaimDb,
  user: { id: string; email: string },
): Promise<boolean> {
  const worker = await db.worker.findFirst({
    where: {
      userId: null,
      timeDoctorEmail: { equals: user.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!worker) return false;

  const result = await db.worker.updateMany({
    where: { id: worker.id, userId: null },
    data: { userId: user.id },
  });
  return result.count === 1;
}
