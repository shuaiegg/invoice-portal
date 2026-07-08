import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { invoicePaidWorkerNotification, invoiceStatusChanged } from "@/lib/slack";
import { syncInvoiceToXero } from "@/lib/xero";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { order: "asc" },
      },
      worker: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;
  const { status } = await req.json();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      worker: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Validate status transition
  // Valid transitions: 
  // SUBMITTED -> APPROVED
  // APPROVED -> PAID
  // ANY -> VOID
  const currentStatus = invoice.status;
  let isValid = false;

  if (status === "VOID") {
    isValid = true;
  } else if (currentStatus === "SUBMITTED" && status === "APPROVED") {
    isValid = true;
  } else if (currentStatus === "APPROVED" && status === "PAID") {
    isValid = true;
  }

  if (!isValid) {
    return NextResponse.json(
      { error: `Invalid status transition from ${currentStatus} to ${status}` },
      { status: 400 }
    );
  }

  // Atomic update: WHERE clause guards against concurrent modification
  const result = await db.invoice.updateMany({
    where: { id, status: currentStatus },
    data: { status },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Invoice status was changed by another request. Please refresh and try again." },
      { status: 409 }
    );
  }

  const updatedInvoice = await db.invoice.findUniqueOrThrow({
    where: { id },
    include: {
      worker: {
        include: {
          user: { select: { email: true } },
        },
      },
      lines: { orderBy: { order: "asc" } },
    },
  });

  // Xero sync happens at PAID — this is the final authoritative invoice
  if (status === "PAID") {
    try {
      await syncInvoiceToXero(updatedInvoice, updatedInvoice.worker);
    } catch (error) {
      console.error("Xero sync failed on PAID transition:", error);
      // Revert status back to APPROVED so admin can retry
      await db.invoice.update({ where: { id }, data: { status: currentStatus } }).catch(() => {});
      return NextResponse.json(
        { error: "Payment marked but Xero sync failed. Invoice reverted to APPROVED. Please try again." },
        { status: 500 }
      );
    }
  }

  invoiceStatusChanged(updatedInvoice, updatedInvoice.worker, currentStatus, status);
  if (status === "PAID" && updatedInvoice.worker.paymentType === "MANUAL") {
    invoicePaidWorkerNotification(updatedInvoice, updatedInvoice.worker);
  }

  return NextResponse.json(updatedInvoice);
}
