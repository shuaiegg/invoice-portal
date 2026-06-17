import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dispatchWebhook } from "@/lib/webhook";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
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
    include: { worker: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.worker.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only submitted invoices can be revoked" }, { status: 400 });
  }

  const revokedInvoice = await db.invoice.update({
    where: { id },
    data: {
      status: "VOID",
    },
    include: { worker: true },
  });

  dispatchWebhook("invoice.revoked", {
    invoiceId: revokedInvoice.id,
    invoiceNumber: revokedInvoice.invoiceNumber,
    worker: {
      id: revokedInvoice.worker.id,
      name: revokedInvoice.worker.name,
      email: session.user.email,
      address: revokedInvoice.worker.address,
      city: revokedInvoice.worker.city,
      country: revokedInvoice.worker.country,
      vatNumber: revokedInvoice.worker.vatNumber,
    },
    invoice: {
      description: revokedInvoice.description,
      period: revokedInvoice.period,
      quantity: revokedInvoice.quantity,
      rate: revokedInvoice.rate,
      subtotal: revokedInvoice.subtotal,
      vatAmount: revokedInvoice.vatAmount,
      totalAmount: revokedInvoice.totalAmount,
      currency: revokedInvoice.currency,
      invoiceDate: revokedInvoice.invoiceDate.toISOString(),
    },
    xeroInvoiceId: revokedInvoice.xeroInvoiceId,
  });

  return NextResponse.json(revokedInvoice);
}
