import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { invoiceSubmitted } from "@/lib/slack";
import { dispatchWebhook } from "@/lib/webhook";
import { parseDateInput } from "@/lib/date-utils";
import { deriveBillingMonth } from "@/lib/billing-month";
import {
  calculateInvoiceAmounts,
  getLegacyInvoiceFields,
  normalizeInvoiceLines,
} from "@/lib/invoice-lines";
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
      include: {
        lines: {
          orderBy: { order: "asc" },
        },
      },
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
  const required = ["period", "invoiceDate"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
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

  const year = invoiceDate.getFullYear();

  let dueDate: Date;
  try {
    dueDate = data.dueDate
      ? parseDateInput(data.dueDate)
      : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
  }

  const invoiceNumber = await generateInvoiceNumber(year);

  const invoice = await db.$transaction(async (tx) => {
    return tx.invoice.create({
      data: {
        workerId: worker.id,
        invoiceNumber,
        invoiceDate,
        billingMonth: deriveBillingMonth(invoiceDate, serviceDate),
        dueDate,
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
        status: "SUBMITTED",
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
        lines: {
          orderBy: { order: "asc" },
        },
      },
    });
  });

  // Fire-and-forget: webhook + Slack
  dispatchWebhook("invoice.submitted", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    worker: { id: worker.id, name: worker.name },
    invoice: { period: invoice.period, totalAmount: invoice.totalAmount, currency: invoice.currency },
  });
  invoiceSubmitted(invoice, worker);

  return NextResponse.json({ invoiceId: invoice.id });
}
