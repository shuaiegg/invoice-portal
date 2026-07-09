import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createPaymentAccountForWorker,
  listPaymentAccountsForWorker,
} from "@/lib/payment-account-actions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getSessionWorker() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return db.worker.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}

export async function GET() {
  const worker = await getSessionWorker();
  if (!worker) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listPaymentAccountsForWorker(worker.id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const worker = await getSessionWorker();
  if (!worker) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await createPaymentAccountForWorker(worker.id, await req.json());
  return NextResponse.json(result.body, { status: result.status });
}
