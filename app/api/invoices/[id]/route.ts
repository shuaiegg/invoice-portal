import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const subtotal = quantity * rate;
  const vatAmount = subtotal * (vatRate / 100);
  const totalAmount = subtotal + vatAmount;

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
      currency: data.currency || "EUR",
    },
    include: {
      worker: true,
    },
  });

  // Dispatch fire-and-forget webhook for update
  dispatchWebhook("invoice.updated", {
    invoiceId: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    worker: {
      id: updatedInvoice.worker.id,
      name: updatedInvoice.worker.name,
      email: session.user.email,
      address: updatedInvoice.worker.address,
      city: updatedInvoice.worker.city,
      country: updatedInvoice.worker.country,
      vatNumber: updatedInvoice.worker.vatNumber,
    },
    invoice: {
      description: updatedInvoice.description,
      period: updatedInvoice.period,
      quantity: updatedInvoice.quantity,
      rate: updatedInvoice.rate,
      subtotal: updatedInvoice.subtotal,
      vatAmount: updatedInvoice.vatAmount,
      totalAmount: updatedInvoice.totalAmount,
      currency: updatedInvoice.currency,
      invoiceDate: updatedInvoice.invoiceDate.toISOString(),
    },
    xeroInvoiceId: updatedInvoice.xeroInvoiceId,
  });

  return NextResponse.json(updatedInvoice);
}
