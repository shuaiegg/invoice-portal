import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { setPreferredPaymentAccountForWorker } from "@/lib/payment-account-actions";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id, accountId } = await params;
  const result = await setPreferredPaymentAccountForWorker(db, id, accountId);
  return NextResponse.json(result.body, { status: result.status });
}
