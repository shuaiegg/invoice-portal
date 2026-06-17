import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

export async function GET() {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoicesThisMonth, pendingCount, paidAmountThisMonth, activeWorkerCount] = await Promise.all([
    // Total invoices this month
    db.invoice.count({
      where: {
        invoiceDate: {
          gte: firstDayOfMonth,
        },
      },
    }),
    // Pending approval count (SUBMITTED)
    db.invoice.count({
      where: {
        status: "SUBMITTED",
      },
    }),
    // Paid amount this month
    db.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: "PAID",
        invoiceDate: {
          gte: firstDayOfMonth,
        },
      },
    }),
    // Active worker count
    db.worker.count({
      where: {
        user: {
          active: true,
        },
      },
    }),
  ]);

  return NextResponse.json({
    invoicesThisMonth,
    pendingCount,
    paidAmountThisMonth: paidAmountThisMonth._sum.totalAmount || 0,
    activeWorkerCount,
  });
}
