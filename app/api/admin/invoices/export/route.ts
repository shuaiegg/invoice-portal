import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { InvoiceStatus, Prisma } from "@/lib/generated/client/client";
import { deriveChannel, parsePaymentChannel, selectChannelAccount, PAYMENT_CHANNEL_LABELS } from "@/lib/payment-channel";
import { resolveWorkerIdsForChannel } from "@/lib/payment-channel-server";
import { formatPaymentAccountKeyDetail } from "@/lib/payment-accounts";

export async function GET(req: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);
  
  const status = searchParams.get("status")?.split(",").filter((value): value is InvoiceStatus =>
    Object.values(InvoiceStatus).includes(value as InvoiceStatus),
  );
  const period = searchParams.get("period");
  const workerName = searchParams.get("workerName");
  const month = searchParams.get("month"); // "YYYY-MM"
  const channel = parsePaymentChannel(searchParams.get("channel"));
  const xero = searchParams.get("xero");

  const where: Prisma.InvoiceWhereInput = {};
  const workerFilter: Prisma.WorkerWhereInput = {};

  if (status && status.length > 0) {
    where.status = { in: status };
  }
  if (period) {
    where.period = { contains: period, mode: "insensitive" };
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.billingMonth = month;
  }
  if (xero === "failed") Object.assign(where, { status: "PAID", xeroSynced: false });

  if (workerName) {
    workerFilter.name = { contains: workerName, mode: "insensitive" };
  }

  if (Object.keys(workerFilter).length > 0) {
    where.worker = workerFilter;
  }
  if (channel) where.workerId = { in: await resolveWorkerIdsForChannel(channel) };

  const invoices = await db.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      worker: {
        select: {
          name: true,
          team: true,
          paymentMethod: true,
          paymentAccount: true,
          paymentNotes: true,
          paymentAccounts: true,
        },
      },
    },
  });

  const headers = [
    "Invoice Number",
    "Worker Name",
    "Team",
    "Payout Channel",
    "Payout Account Detail",
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

  const escapeCSV = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // If it contains quotes, commas, or newlines, wrap in quotes and escape quotes
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = invoices.map((inv) => {
    const channel = deriveChannel(inv.worker);
    const selectedAccount = selectChannelAccount(inv.worker.paymentAccounts, channel);
    const payoutDetail = selectedAccount
      ? formatPaymentAccountKeyDetail(selectedAccount)
      : inv.worker.paymentAccount || inv.worker.paymentMethod || inv.worker.paymentNotes || "";
    return [
    escapeCSV(inv.invoiceNumber),
    escapeCSV(inv.worker.name),
    escapeCSV(inv.worker.team || ""),
    escapeCSV(PAYMENT_CHANNEL_LABELS[channel]),
    escapeCSV(payoutDetail),
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
    ];
  });

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
