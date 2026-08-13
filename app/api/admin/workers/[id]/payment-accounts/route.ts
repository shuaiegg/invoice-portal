import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import {
  createPaymentAccountForWorker,
  listPaymentAccountsForWorker,
} from "@/lib/payment-account-actions";
import { NextResponse } from "next/server";

async function getWorker(id: string) {
  return db.worker.findUnique({ where: { id }, select: { id: true } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!await getWorker(id)) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const result = await listPaymentAccountsForWorker(db, id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!await getWorker(id)) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const result = await createPaymentAccountForWorker(db, id, await req.json());
  return NextResponse.json(result.body, { status: result.status });
}
