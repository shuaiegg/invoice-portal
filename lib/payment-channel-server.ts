import { db } from "./db";
import { deriveChannel, filterWorkerIdsByChannel, type PaymentChannel } from "./payment-channel";

export async function resolveWorkerChannelMap(workerIds?: string[]) {
  const workers = await db.worker.findMany({
    where: workerIds ? { id: { in: workerIds } } : undefined,
    select: {
      id: true,
      paymentAccounts: { select: { type: true, isPreferred: true } },
    },
  });
  return new Map(workers.map((worker) => [worker.id, deriveChannel(worker.paymentAccounts)]));
}

export async function resolveWorkerIdsForChannel(channel: PaymentChannel, workerIds?: string[]) {
  return filterWorkerIdsByChannel(await resolveWorkerChannelMap(workerIds), channel);
}
