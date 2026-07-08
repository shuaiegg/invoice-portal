import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/client/client";

export async function GET(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);
  
  // Filtering
  const status = searchParams.get("status")?.split(",") as any[];
  const period = searchParams.get("period");
  const workerName = searchParams.get("workerName");
  const team = searchParams.get("team");
  
  // Pagination
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;
  
  // Sorting
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";

  const where: Prisma.InvoiceWhereInput = {};
  const workerFilter: Prisma.WorkerWhereInput = {};

  if (status && status.length > 0) {
    where.status = { in: status };
  }
  if (period) {
    where.period = { contains: period, mode: "insensitive" };
  }
  
  if (workerName) {
    workerFilter.name = { contains: workerName, mode: "insensitive" };
  }
  if (team) {
    workerFilter.team = { contains: team, mode: "insensitive" };
  }

  if (Object.keys(workerFilter).length > 0) {
    where.worker = workerFilter;
  }

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip,
      take: limit,
      include: {
        lines: {
          orderBy: { order: "asc" },
        },
        worker: {
          select: {
            name: true,
            team: true,
          },
        },
      },
    }),
    db.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
