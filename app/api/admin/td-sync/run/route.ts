import { requireAdmin } from "@/lib/admin-guard";
import { runTdSync } from "@/lib/td-sync";
import { resolveTdSyncMonth } from "@/lib/td-sync-month";
import { NextResponse } from "next/server";
import { after } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  let target;
  try {
    const text = await request.text();
    target = resolveTdSyncMonth(text ? JSON.parse(text) : undefined);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid sync month" },
      { status: 400 },
    );
  }

  after(() => runTdSync({
    ...target, triggeredBy: guard.session!.user.id,
  }));
  return NextResponse.json({ started: true }, { status: 202 });
}
