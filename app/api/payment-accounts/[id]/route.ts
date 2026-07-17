import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deletePaymentAccountForWorker,
  updatePaymentAccountForWorker,
} from "@/lib/payment-account-actions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getSessionWorker() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  return worker;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const worker = await getSessionWorker();
  if (!worker) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await updatePaymentAccountForWorker(db, worker.id, id, await req.json());
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const worker = await getSessionWorker();
  if (!worker) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deletePaymentAccountForWorker(db, worker.id, id);
  return NextResponse.json(result.body, { status: result.status });
}
