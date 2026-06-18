import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncInvoiceToXero } from "@/lib/xero";
import { notifySlack } from "@/lib/slack";
import { dispatchWebhook } from "@/lib/webhook";
import { parseDateInput } from "@/lib/date-utils";
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
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Security check: must be the worker who created it OR an admin
  const isOwner = invoice.worker.userId === session.user.id;
  const isAdmin = (session.user as any).role === "ADMIN";

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

  // Security check: only the owner can edit
  if (invoice.worker.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Status check: only SUBMITTED can be edited
  if (invoice.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only submitted invoices can be edited" }, { status: 400 });
  }

  const quantity = parseFloat(data.quantity);
  const rate = parseFloat(data.rate);
  const vatRate = parseFloat(data.vatRate) || 0;
  const vatInclusive = data.vatInclusive === true || data.vatInclusive === "true";

  let subtotal: number, vatAmount: number, totalAmount: number;
  if (vatRate > 0 && vatInclusive) {
    totalAmount = quantity * rate;
    subtotal = totalAmount / (1 + vatRate / 100);
    vatAmount = totalAmount - subtotal;
  } else {
    subtotal = quantity * rate;
    vatAmount = subtotal * (vatRate / 100);
    totalAmount = subtotal + vatAmount;
  }

  let invoiceDate: Date;
  try {
    invoiceDate = parseDateInput(data.invoiceDate);
  } catch {
    return NextResponse.json({ error: "Invalid invoiceDate" }, { status: 400 });
  }

  const updatedInvoice = await db.invoice.update({
    where: { id },
    data: {
      invoiceDate,
      serviceDate: data.serviceDate ? parseDateInput(data.serviceDate) : null,
      description: data.description,
      period: data.period,
      quantity,
      rate,
      subtotal,
      vatAmount,
      totalAmount,
      vatRate,
      vatInclusive,
      currency: data.currency || "EUR",
    },
    include: {
      worker: true,
    },
  });

  // Synchronous Xero sync
  try {
    await syncInvoiceToXero(updatedInvoice, updatedInvoice.worker);
  } catch (error) {
    console.error("Xero sync failed during update:", error);
    return NextResponse.json({
      error: "Invoice updated but Xero sync failed. Please contact support.",
      invoice: updatedInvoice,
    }, { status: 500 });
  }

  // Fire-and-forget: n8n webhook + direct Slack fallback
  dispatchWebhook("invoice.updated", {
    invoiceId: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    worker: { id: updatedInvoice.worker.id, name: updatedInvoice.worker.name },
    invoice: { period: updatedInvoice.period, totalAmount: updatedInvoice.totalAmount, currency: updatedInvoice.currency },
  });
  notifySlack({
    text: `📝 Invoice updated\n*${updatedInvoice.worker.name}* | ${updatedInvoice.period}\nAmount: ${updatedInvoice.totalAmount} ${updatedInvoice.currency}\nInvoice #: ${updatedInvoice.invoiceNumber}\nXero: Updated ✅`,
  });

  return NextResponse.json(updatedInvoice);
}
