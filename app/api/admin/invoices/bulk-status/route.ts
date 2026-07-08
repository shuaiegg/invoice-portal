import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { invoicePaidWorkerNotification, invoiceStatusChanged } from "@/lib/slack";
import { syncInvoiceToXero } from "@/lib/xero";
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
    data: { status: "PAID" },
  });

  // Re-fetch after update so Xero sync and notifications only fire for actually updated invoices
  const updatedInvoices = await db.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      status: "PAID",
    },
    include: {
      worker: {
        include: {
          user: { select: { email: true } },
        },
      },
      lines: { orderBy: { order: "asc" } },
    },
  });

  const xeroErrors: string[] = [];
  for (const invoice of updatedInvoices) {
    // Xero sync at PAID — fire-and-forget per invoice, log failures
    syncInvoiceToXero(invoice, invoice.worker).catch((err) => {
      console.error(`Xero sync failed for invoice ${invoice.invoiceNumber}:`, err);
      xeroErrors.push(invoice.invoiceNumber);
    });

    invoiceStatusChanged(invoice, invoice.worker, "APPROVED", "PAID");
    if (invoice.worker.paymentType === "MANUAL") {
      invoicePaidWorkerNotification(invoice, invoice.worker);
    }
  }

  return NextResponse.json({
    success: true,
    count: result.count,
  });
}
