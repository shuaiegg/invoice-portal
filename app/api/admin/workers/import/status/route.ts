import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const [conflicts, batches] = await Promise.all([
    db.workerRateConflict.findMany({
      where: { resolved: false },
      include: { worker: { select: { name: true, timeDoctorEmail: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.workerImportBatch.findMany({ orderBy: { importedAt: "desc" }, take: 12 }),
  ]);
  return NextResponse.json({ conflicts, batches });
}
