import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
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
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;
  const { status } = await req.json();

  const invoice = await db.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Validate status transition
  // Valid transitions: 
  // SUBMITTED -> APPROVED
  // APPROVED -> PAID
  // ANY -> VOID
  const currentStatus = invoice.status;
  let isValid = false;

  if (status === "VOID") {
    isValid = true;
  } else if (currentStatus === "SUBMITTED" && status === "APPROVED") {
    isValid = true;
  } else if (currentStatus === "APPROVED" && status === "PAID") {
    isValid = true;
  }

  if (!isValid) {
    return NextResponse.json(
      { error: `Invalid status transition from ${currentStatus} to ${status}` },
      { status: 400 }
    );
  }

  const updatedInvoice = await db.invoice.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updatedInvoice);
}
