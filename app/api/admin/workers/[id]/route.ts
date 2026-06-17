import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;

  const worker = await db.worker.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          active: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  return NextResponse.json(worker);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;
  const { active } = await req.json();

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid active status" }, { status: 400 });
  }

  const worker = await db.worker.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  await db.user.update({
    where: { id: worker.userId },
    data: { active },
  });

  return NextResponse.json({ success: true, active });
}
