export function isWorkerProfileComplete(worker: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
} | null | undefined): boolean {
  return !!(
    worker &&
    worker.name &&
    worker.address &&
    worker.city &&
    worker.country
  );
}
