import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { dispatchWebhook } from "@/lib/webhook";
import { parseDateInput } from "@/lib/date-utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
  });

  if (!worker) {
    return NextResponse.json({ invoices: [], total: 0 });
  }

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.invoice.count({
      where: { workerId: worker.id },
    }),
  ]);

  return NextResponse.json({
    invoices,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker profile not found" }, { status: 404 });
  }

  const data = await req.json();

  // Basic validation
  const required = ["description", "period", "quantity", "rate", "invoiceDate"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const quantity = parseFloat(data.quantity);
  const rate = parseFloat(data.rate);
  const vatRate = parseFloat(data.vatRate) || 0;

  if (isNaN(quantity) || quantity <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  if (isNaN(rate) || rate <= 0) return NextResponse.json({ error: "Invalid rate" }, { status: 400 });

  const subtotal = quantity * rate;
  const vatAmount = subtotal * (vatRate / 100);
  const totalAmount = subtotal + vatAmount;

  let invoiceDate: Date;
  try {
    invoiceDate = parseDateInput(data.invoiceDate);
  } catch {
    return NextResponse.json({ error: "Invalid invoiceDate" }, { status: 400 });
  }

  const year = invoiceDate.getFullYear();

  // Due Date (default 30 days)
  const dueDate = data.dueDate
    ? parseDateInput(data.dueDate)
    : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const invoiceNumber = await generateInvoiceNumber(year);

  const invoice = await db.invoice.create({
    data: {
      workerId: worker.id,
      invoiceNumber,
      invoiceDate,
      dueDate,
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
      status: "SUBMITTED",
    },
    include: {
      worker: true,
    },
  });

  // Dispatch fire-and-forget webhook
  dispatchWebhook("invoice.submitted", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    worker: {
      id: worker.id,
      name: worker.name,
      email: session.user.email,
      address: worker.address,
      city: worker.city,
      country: worker.country,
      vatNumber: worker.vatNumber,
    },
    invoice: {
      description: invoice.description,
      period: invoice.period,
      quantity: invoice.quantity,
      rate: invoice.rate,
      subtotal: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      invoiceDate: invoice.invoiceDate.toISOString(),
    },
    xeroInvoiceId: null,
  });

  return NextResponse.json({ invoiceId: invoice.id });
}
