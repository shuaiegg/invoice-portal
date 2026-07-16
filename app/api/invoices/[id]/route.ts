import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminUser } from "@/lib/auth-role";
import { invoiceUpdated } from "@/lib/slack";
import { isWorkerInvoiceEditable } from "@/lib/invoice-status";
import { dispatchWebhook } from "@/lib/webhook";
import { parseDateInput } from "@/lib/date-utils";
import { deriveBillingMonth, resolveInvoiceSlot } from "@/lib/billing-month";
import { Prisma } from "@/lib/generated/client/client";
import {
  calculateInvoiceAmounts,
  getLegacyInvoiceFields,
  normalizeInvoiceLines,
} from "@/lib/invoice-lines";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      worker: true,
      lines: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Security check: must be the worker who created it OR an admin
  const isOwner = invoice.worker.userId === session.user.id;
  const isAdmin = isOwner ? false : await isAdminUser(session.user.id);

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(invoice);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { worker: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.worker.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isWorkerInvoiceEditable(invoice.status)) {
    return NextResponse.json({ error: "Only draft or submitted invoices can be edited" }, { status: 400 });
  }

  const normalized = normalizeInvoiceLines(data.lines);
  if (!normalized.lines) {
    return NextResponse.json({ error: normalized.error }, { status: 422 });
  }
  const lines = normalized.lines;

  const lineSubtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const vatRate = parseFloat(data.vatRate) || 0;
  const vatInclusive = data.vatInclusive === true || data.vatInclusive === "true";
  const { subtotal, vatAmount, totalAmount } = calculateInvoiceAmounts(
    lineSubtotal,
    vatRate,
    vatInclusive,
  );
  const legacyFields = getLegacyInvoiceFields(lines);

  let invoiceDate: Date;
  let serviceDate: Date | null;
  try {
    invoiceDate = parseDateInput(data.invoiceDate);
    serviceDate = data.serviceDate ? parseDateInput(data.serviceDate) : null;
  } catch {
    return NextResponse.json({ error: "Invalid invoiceDate or serviceDate" }, { status: 400 });
  }

  const billingMonth = deriveBillingMonth(invoiceDate, serviceDate);
  let supplementNo = invoice.supplementNo;
  if (billingMonth !== invoice.billingMonth) {
    // Moving to a different month: re-resolve this invoice's slot there
    const monthInvoices = await db.invoice.findMany({
      where: { workerId: invoice.workerId, billingMonth, id: { not: id } },
      select: { status: true, supplementNo: true },
    });
    const slot = resolveInvoiceSlot(monthInvoices);
    if ("conflict" in slot) {
      return NextResponse.json(
        { error: `You already have an editable invoice for ${billingMonth}. Edit that invoice and add line items instead.` },
        { status: 409 },
      );
    }
    supplementNo = slot.supplementNo;
  }

  const updatedInvoice = await db.$transaction(async (tx) => {
    // Re-check status inside transaction — guards against concurrent admin approval
    const current = await tx.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!current || !isWorkerInvoiceEditable(current.status)) {
      throw new Error("CONCURRENT_MODIFICATION");
    }

    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

    return tx.invoice.update({
      where: { id },
      data: {
        invoiceDate,
        billingMonth,
        supplementNo,
        serviceDate,
        description: legacyFields.description,
        period: data.period,
        quantity: legacyFields.quantity,
        rate: legacyFields.rate,
        subtotal,
        vatAmount,
        totalAmount,
        vatRate,
        vatInclusive,
        currency: data.currency || "EUR",
        ...(invoice.status === "DRAFT" ? { status: "SUBMITTED" as const } : {}),
        lines: {
          create: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitRate: line.unitRate,
            amount: line.amount,
            order: line.order,
          })),
        },
      },
      include: {
        worker: true,
        lines: { orderBy: { order: "asc" } },
      },
    });
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "CONCURRENT_MODIFICATION") {
      return null;
    }
    // Unique (workerId, billingMonth, supplementNo): a concurrent submission took this slot
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  });

  if (!updatedInvoice) {
    return NextResponse.json(
      { error: "Invoice was modified or approved by another user. Please refresh and try again." },
      { status: 409 }
    );
  }

  dispatchWebhook("invoice.updated", {
    invoiceId: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    worker: { id: updatedInvoice.worker.id, name: updatedInvoice.worker.name },
    invoice: { period: updatedInvoice.period, totalAmount: updatedInvoice.totalAmount, currency: updatedInvoice.currency },
  });
  invoiceUpdated(updatedInvoice, updatedInvoice.worker);

  return NextResponse.json(updatedInvoice);
}
