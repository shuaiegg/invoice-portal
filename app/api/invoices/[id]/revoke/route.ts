import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifySlack } from "@/lib/slack";
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

  notifySlack({
    text: `Invoice revoked: ${revokedInvoice.invoiceNumber} by ${revokedInvoice.worker.name} (${revokedInvoice.totalAmount} ${revokedInvoice.currency})`
  });

  return NextResponse.json(revokedInvoice);
}
