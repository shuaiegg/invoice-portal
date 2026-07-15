import { WorkerImportAdmin } from "@/components/admin/worker-import-admin";
import { db } from "@/lib/db";

export default async function WorkerImportPage() {
  const [conflicts, batches] = await Promise.all([
    db.workerRateConflict.findMany({
      where: { resolved: false },
      include: { worker: { select: { name: true, timeDoctorEmail: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.workerImportBatch.findMany({ orderBy: { importedAt: "desc" }, take: 12 }),
  ]);

  const importerIds = [...new Set(batches.map((batch) => batch.importedBy))];
  const importers = importerIds.length
    ? await db.user.findMany({ where: { id: { in: importerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const importerNames = new Map(importers.map((user) => [user.id, user.name || user.email]));

  return (
    <WorkerImportAdmin
      conflicts={conflicts}
      batches={batches.map((batch) => ({ ...batch, importedBy: importerNames.get(batch.importedBy) || batch.importedBy }))}
    />
  );
}
