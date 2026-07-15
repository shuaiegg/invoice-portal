export type TdSyncMonth = { year: number; month: number };

export function resolveTdSyncMonth(input: unknown, now = new Date()): TdSyncMonth {
  const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (input === undefined || input === null) {
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1 };
  }

  if (typeof input !== "object") throw new Error("Invalid sync month");
  const { year, month } = input as Partial<TdSyncMonth>;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month! < 1 || month! > 12) {
    throw new Error("Invalid sync month");
  }

  const targetIndex = year! * 12 + month! - 1;
  const monthsAgo = currentIndex - targetIndex;
  if (monthsAgo < 1 || monthsAgo > 24) throw new Error("Sync month must be a past month within 24 months");
  return { year: year!, month: month! };
}

export function partitionExistingWorkerIds(workerIds: string[], existingWorkerIds: Set<string>) {
  const pendingWorkerIds = workerIds.filter((workerId) => !existingWorkerIds.has(workerId));
  return { pendingWorkerIds, skippedExisting: workerIds.length - pendingWorkerIds.length };
}
