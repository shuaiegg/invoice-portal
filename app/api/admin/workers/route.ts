import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/client/client";

export async function GET(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  const where: Prisma.WorkerWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { team: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const workers = await db.worker.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
          active: true,
          createdAt: true,
        },
      },
      _count: {
        select: { invoices: true },
      },
      invoices: {
        take: 1,
        orderBy: { invoiceDate: "desc" },
        select: { invoiceDate: true },
      },
    },
    orderBy: {
      user: { createdAt: "desc" },
    },
  });

  const formattedWorkers = workers.map((w) => ({
    id: w.id,
    name: w.name,
    team: w.team,
    email: w.user.email,
    active: w.user.active,
    paymentType: w.paymentType,
    timeDoctorEmail: w.timeDoctorEmail,
    invoiceCount: w._count.invoices,
    lastSubmission: w.invoices[0]?.invoiceDate || null,
    joinedAt: w.user.createdAt,
  }));

  return NextResponse.json(formattedWorkers);
}
