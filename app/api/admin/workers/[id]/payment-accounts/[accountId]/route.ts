import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import {
  deletePaymentAccountForWorker,
  updatePaymentAccountForWorker,
} from "@/lib/payment-account-actions";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id, accountId } = await params;
  const result = await updatePaymentAccountForWorker(db, id, accountId, await req.json());
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id, accountId } = await params;
  const result = await deletePaymentAccountForWorker(db, id, accountId);
  return NextResponse.json(result.body, { status: result.status });
}
