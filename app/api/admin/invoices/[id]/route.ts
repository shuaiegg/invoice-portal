import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { dispatchWebhook } from "@/lib/webhook";
import { isAdminInvoiceTransitionAllowed } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@/lib/generated/client/enums";
import { syncInvoiceToXero } from "@/lib/xero";
import { logInvoiceStatusChanged } from "@/lib/audit";
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
  const adminCheck = await requireAdmin();
  if (!adminCheck.authorized) return adminCheck.response;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const session = adminCheck.session!;

  const { id } = await params;
  const { status, note } = await req.json();

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const currentStatus = invoice.status;
  const isValid = isAdminInvoiceTransitionAllowed(currentStatus, status as InvoiceStatus);

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

  // Xero sync happens at PAID — failure keeps the invoice PAID (payment is recorded)
  // and sets xeroSynced=false so the retry endpoint can re-attempt later.
  let xeroWarning: string | undefined;
  if (status === "PAID") {
    try {
      await syncInvoiceToXero(updatedInvoice, updatedInvoice.worker);
    } catch (error) {
      console.error("Xero sync failed on PAID transition:", error);
      xeroWarning = error instanceof Error ? error.message : "Xero sync failed";
    }
  }

  dispatchWebhook("invoice.status_changed", {
    invoiceId: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    worker: { id: updatedInvoice.worker.id, name: updatedInvoice.worker.name },
    invoice: { period: updatedInvoice.period, totalAmount: updatedInvoice.totalAmount, currency: updatedInvoice.currency },
    from: currentStatus,
    to: status,
  });
  if (status === "PAID") {
    dispatchWebhook("invoice.paid", {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      worker: {
        id: updatedInvoice.worker.id,
        name: updatedInvoice.worker.name,
        paymentType: updatedInvoice.worker.paymentType,
        email: updatedInvoice.worker.user?.email ?? null,
      },
      invoice: { period: updatedInvoice.period, totalAmount: updatedInvoice.totalAmount, currency: updatedInvoice.currency },
    });
  }
  // Request changes: tell the worker what to fix — the invoice is back in their court
  if (currentStatus === "SUBMITTED" && status === "DRAFT") {
    dispatchWebhook("invoice.changes_requested", {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      worker: { id: updatedInvoice.worker.id, name: updatedInvoice.worker.name },
      invoice: { period: updatedInvoice.period, totalAmount: updatedInvoice.totalAmount, currency: updatedInvoice.currency },
      note: typeof note === "string" ? note.trim() || null : null,
    });
  }

  await logInvoiceStatusChanged(
    session.user.id,
    session.user.name ?? session.user.email,
    updatedInvoice.id,
    {
      invoiceNumber: updatedInvoice.invoiceNumber,
      workerName: updatedInvoice.worker.name,
      from: currentStatus,
      to: status,
    }
  );

  return NextResponse.json({ ...updatedInvoice, xeroWarning });
}
