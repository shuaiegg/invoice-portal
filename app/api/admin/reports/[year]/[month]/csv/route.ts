import { requireAdmin } from "@/lib/admin-guard";
import { getReportInvoicesForCsv } from "@/lib/report-generator";

const escapeCSV = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { year: yearStr, month: monthStr } = await params;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) {
    return new Response("Invalid year/month", { status: 400 });
  }

  const invoices = await getReportInvoicesForCsv(year, month);

  const headers = [
    "Invoice Number",
    "Worker Name",
    "Payment Method",
    "Amount",
    "Currency",
    "Invoice Date",
    "Xero Synced",
    "Xero Invoice ID",
  ];

  const rows = invoices.map((inv) => [
    escapeCSV(inv.invoiceNumber),
    escapeCSV(inv.worker.name),
    escapeCSV(inv.worker.paymentMethod ?? ""),
    escapeCSV(inv.totalAmount.toFixed(2)),
    escapeCSV(inv.currency),
    escapeCSV(inv.invoiceDate.toISOString().split("T")[0]),
    escapeCSV(inv.xeroSynced ? "Yes" : "No"),
    escapeCSV(inv.xeroInvoiceId ?? ""),
  ]);

  const BOM = "\uFEFF";
  const csv = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${billingMonth}.csv"`,
    },
  });
}
