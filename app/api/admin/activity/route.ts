import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

export async function GET() {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const recentInvoices = await db.invoice.findMany({
    take: 10,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      worker: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json(recentInvoices);
}
