import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { resolveBulkInvoiceTargets, syncBulkInvoicesToXero } from "@/lib/bulk-invoice-server";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  let resolved;
  try {
    resolved = await resolveBulkInvoiceTargets(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid target" }, { status: 400 });
  }

  const retryable = resolved.filter((invoice) => invoice.status === "PAID" && !invoice.xeroSynced);
  const xero = await syncBulkInvoicesToXero(retryable);
  return NextResponse.json({
    targeted: resolved.length,
    transitioned: 0,
    skippedWrongStatus: resolved.length - retryable.length,
    ...xero,
  });
}
