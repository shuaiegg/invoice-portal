import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;
  const { id } = await params;
  const { action } = await request.json();
  if (action !== "keep_portal" && action !== "use_imported") {
    return NextResponse.json({ error: "Invalid resolution" }, { status: 400 });
  }

  const conflict = await db.workerRateConflict.findUnique({ where: { id } });
  if (!conflict || conflict.resolved) {
    return NextResponse.json({ error: "Conflict not found" }, { status: 404 });
  }

  await db.$transaction([
    ...(action === "use_imported"
      ? [db.worker.update({
          where: { id: conflict.workerId },
          data: {
            hourlyRate: conflict.importedRate,
            hourlyRateSource: "TD_IMPORT",
            hourlyRateUpdatedAt: new Date(),
            hourlyRateUpdatedBy: null,
          },
        })]
      : []),
    db.workerRateConflict.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: session.user.id },
    }),
  ]);
  return NextResponse.json({ success: true });
}
