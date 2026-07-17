import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { generateClaimToken } from "@/lib/worker-claim-token";
import { NextResponse } from "next/server";

// Issues (or reissues, invalidating any previous one) a claim token for a still-unclaimed
// worker — used both right after "Add worker" and later from the worker detail page if the
// original link was lost or expired (openspec/changes/close-worker-registration).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  const worker = await db.worker.findUnique({ where: { id }, select: { userId: true, timeDoctorEmail: true } });
  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  if (worker.userId) return NextResponse.json({ error: "Worker has already claimed their account" }, { status: 400 });
  if (!worker.timeDoctorEmail) {
    return NextResponse.json({ error: "Worker needs a Time Doctor email before a claim link can be issued" }, { status: 400 });
  }

  const { token, expiresAt } = generateClaimToken();
  await db.worker.update({ where: { id }, data: { claimToken: token, claimTokenExpiresAt: expiresAt } });

  return NextResponse.json({ success: true, claimToken: token });
}
