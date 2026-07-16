import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { resolveBulkInvoiceTargets, syncBulkInvoicesToXero } from "@/lib/bulk-invoice-server";
import { withConnectionRetry } from "@/lib/worker-import";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  try {
    const body = await req.json();
    // Retryable set pinned in SQL: only PAID rows whose Xero sync failed
    const retryable = await withConnectionRetry(() =>
      resolveBulkInvoiceTargets(body, { status: "PAID", xeroSynced: false }),
    );
    const xero = await syncBulkInvoicesToXero(retryable);
    return NextResponse.json({
      targeted: retryable.length,
      transitioned: 0,
      skippedWrongStatus: 0,
      ...xero,
    });
  } catch (error) {
    console.error("Xero retry failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Xero retry failed" },
      { status: 500 },
    );
  }
}
