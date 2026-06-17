import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("X-Internal-Secret");
    const body = await request.json();
    const { invoiceId, xeroInvoiceId } = body;

    if (!invoiceId || !xeroInvoiceId) {
      return NextResponse.json(
        { error: "Missing invoiceId or xeroInvoiceId" },
        { status: 400 }
      );
    }

    const environment = process.env.WEBHOOK_ENVIRONMENT || process.env.NODE_ENV || "development";

    // Fetch the webhook config that corresponds to the event that triggered n8n
    const config = await db.webhookConfig.findUnique({
      where: {
        key_environment: {
          key: "invoice.submitted",
          environment,
        },
      },
    });

    if (!config || !config.internalSecret || config.internalSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update the invoice with Xero sync details
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        xeroSynced: true,
        xeroInvoiceId,
        xeroSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync status update failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
