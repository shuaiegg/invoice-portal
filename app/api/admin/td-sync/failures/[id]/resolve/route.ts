import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;
  const { id } = await params;
  const { workerId, dismiss, ignore } = await request.json();
  const failure = await db.tdMatchFailure.findUnique({ where: { id } });
  if (!failure || failure.resolved) return NextResponse.json({ error: "Failure not found" }, { status: 404 });
  if (!dismiss && !ignore && typeof workerId !== "string") {
    return NextResponse.json({ error: "Worker is required" }, { status: 400 });
  }
  await db.$transaction([
    ...(!dismiss && !ignore ? [db.worker.update({ where: { id: workerId }, data: { timeDoctorEmail: failure.tdEmail } })] : []),
    // Permanent — unlike a plain dismiss, this TD user won't generate a fresh match failure next
    // month either (e.g. the company owner's own TD account, which is tracked but never invoiced).
    ...(ignore ? [db.tdIgnoredEmail.upsert({
      where: { email: failure.tdEmail },
      create: { email: failure.tdEmail, ignoredBy: session.user.id },
      update: {},
    })] : []),
    db.tdMatchFailure.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } }),
  ]);
  return NextResponse.json({ success: true });
}
