import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { Prisma } from "@/lib/generated/client/client";

export async function GET(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);
  
  const status = searchParams.get("status")?.split(",") as any[];
  const period = searchParams.get("period");
  const workerName = searchParams.get("workerName");

  const where: Prisma.InvoiceWhereInput = {};
  const workerFilter: Prisma.WorkerWhereInput = {};

  if (status && status.length > 0) {
    where.status = { in: status };
  }
  if (period) {
    where.period = { contains: period, mode: "insensitive" };
  }
  
  if (workerName) {
    workerFilter.name = { contains: workerName, mode: "insensitive" };
  }

  if (Object.keys(workerFilter).length > 0) {
    where.worker = workerFilter;
  }

  const invoices = await db.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      worker: {
        select: {
          name: true,
          team: true,
        },
      },
    },
  });

  const headers = [
    "Invoice Number",
    "Worker Name",
    "Team",
    "Period",
    "Description",
    "Quantity",
    "Rate",
    "Net Amount",
    "VAT Amount",
    "Total Amount",
    "Status",
    "Invoice Date",
    "Xero Synced",
  ];

  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // If it contains quotes, commas, or newlines, wrap in quotes and escape quotes
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = invoices.map((inv) => [
    escapeCSV(inv.invoiceNumber),
    escapeCSV(inv.worker.name),
    escapeCSV(inv.worker.team || ""),
    escapeCSV(inv.period),
    escapeCSV(inv.description),
    escapeCSV(inv.quantity),
    escapeCSV(inv.rate),
    escapeCSV(inv.subtotal),
    escapeCSV(inv.vatAmount),
    escapeCSV(inv.totalAmount),
    escapeCSV(inv.status),
    escapeCSV(inv.invoiceDate.toISOString().split("T")[0]),
    escapeCSV(inv.xeroSynced ? "Yes" : "No"),
  ]);

  const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");

  // Add UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";
  const content = BOM + csvContent;

  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
