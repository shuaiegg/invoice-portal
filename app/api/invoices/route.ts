import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { syncInvoiceToXero } from "@/lib/xero";
import { notifySlack } from "@/lib/slack";
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
  const vatInclusive = data.vatInclusive === true || data.vatInclusive === "true";

  if (isNaN(quantity) || quantity <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  if (isNaN(rate) || rate <= 0) return NextResponse.json({ error: "Invalid rate" }, { status: 400 });

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
      vatInclusive,
      currency: data.currency || "EUR",
      status: "SUBMITTED",
    },
    include: {
      worker: true,
    },
  });

  // Synchronous Xero sync
  try {
    await syncInvoiceToXero(invoice, worker);
  } catch (error) {
    console.error("Xero sync failed during submission:", error);
    return NextResponse.json({
      error: "Invoice saved but Xero sync failed. Please contact support or try again later.",
      invoiceId: invoice.id,
    }, { status: 500 });
  }

  // Fire-and-forget: n8n webhook (Slack notification etc.) + direct Slack fallback
  dispatchWebhook("invoice.submitted", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    worker: { id: worker.id, name: worker.name },
    invoice: { period: invoice.period, totalAmount: invoice.totalAmount, currency: invoice.currency },
  });
  notifySlack({
    text: `📄 New invoice submitted\n*${worker.name}* | ${invoice.period}\nAmount: ${invoice.totalAmount} ${invoice.currency}\nInvoice #: ${invoice.invoiceNumber}\nXero: Created ✅`,
  });

  return NextResponse.json({ invoiceId: invoice.id });
}
