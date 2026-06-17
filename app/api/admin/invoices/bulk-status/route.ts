import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { invoiceIds, status } = await req.json();

  if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return NextResponse.json({ error: "No invoice IDs provided" }, { status: 400 });
  }

  if (status !== "PAID") {
    return NextResponse.json({ error: "Only bulk PAID status is supported" }, { status: 400 });
  }

  // Only allowed transition is APPROVED -> PAID
  const result = await db.invoice.updateMany({
    where: {
      id: { in: invoiceIds },
      status: "APPROVED",
    },
    data: {
      status: "PAID",
    },
  });

  return NextResponse.json({ 
    success: true, 
    count: result.count 
  });
}
