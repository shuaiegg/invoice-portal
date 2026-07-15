import { requireAdmin } from "@/lib/admin-guard";
import { runTdSync } from "@/lib/td-sync";
import { NextResponse } from "next/server";
import { after } from "next/server";

export const maxDuration = 300;

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  after(() => runTdSync({
    year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1, triggeredBy: guard.session!.user.id,
  }));
  return NextResponse.json({ started: true }, { status: 202 });
}
