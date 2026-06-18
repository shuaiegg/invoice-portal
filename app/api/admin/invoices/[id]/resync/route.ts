import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { dispatchWebhook } from "@/lib/webhook";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response!;

  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      worker: {
        include: { user: { select: { email: true } } },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xeroSynced) {
    return NextResponse.json(
      { error: "Invoice is already synced to Xero" },
      { status: 400 }
    );
  }

  if (invoice.status === "VOID") {
    return NextResponse.json(
      { error: "Cannot re-sync a voided invoice" },
      { status: 400 }
    );
  }

  const { worker } = invoice;

  dispatchWebhook("invoice.submitted", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    updatedAt: invoice.updatedAt.toISOString(),
    worker: {
      id: worker.id,
      name: worker.name,
      email: worker.user.email,
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
    xeroInvoiceId: invoice.xeroInvoiceId,
  });

  return NextResponse.json({ queued: true });
}
