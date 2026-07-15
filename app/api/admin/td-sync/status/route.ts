import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const [runs, failures, workers] = await Promise.all([
    db.tdSyncRun.findMany({ orderBy: { runAt: "desc" }, take: 12 }),
    db.tdMatchFailure.findMany({ where: { resolved: false }, orderBy: { syncRun: { runAt: "desc" } } }),
    db.worker.findMany({ select: { id: true, name: true, timeDoctorEmail: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ lastRun: runs[0] ?? null, runs, failures, workers });
}
