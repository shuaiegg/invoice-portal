import { db } from "./db";

/**
 * Generates (or regenerates) a MonthlyReport for a given year/month.
 * Aggregates all PAID invoices for that billing month.
 * Idempotent: upserts so it's safe to re-run if invoices were marked PAID after the cron fired.
 */
export async function generateMonthlyReport(year: number, month: number) {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  const invoices = await db.invoice.findMany({
    where: { billingMonth, status: "PAID" },
    select: {
      totalAmount: true,
      currency: true,
      xeroSynced: true,
    },
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const workerCount = await db.invoice.groupBy({
    by: ["workerId"],
    where: { billingMonth, status: "PAID" },
  }).then((rows) => rows.length);

  const currencyBreakdown: Record<string, number> = {};
  for (const inv of invoices) {
    currencyBreakdown[inv.currency] = (currencyBreakdown[inv.currency] ?? 0) + inv.totalAmount;
  }

  const totalPaid = invoices.length;
  const xeroSynced = invoices.filter((inv) => inv.xeroSynced).length;
  const xeroStatus =
    totalPaid === 0
      ? "No paid invoices"
      : xeroSynced === totalPaid
        ? "All synced"
        : `${xeroSynced}/${totalPaid} synced`;

  return await db.monthlyReport.upsert({
    where: { year_month: { year, month } },
    create: { year, month, totalAmount, workerCount, currencyBreakdown, xeroStatus },
    update: { totalAmount, workerCount, currencyBreakdown, xeroStatus, generatedAt: new Date() },
  });
}

/** Returns the paid invoices for a month formatted for CSV export. */
export async function getReportInvoicesForCsv(year: number, month: number) {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  return await db.invoice.findMany({
    where: { billingMonth, status: "PAID" },
    orderBy: { invoiceNumber: "asc" },
    include: {
      worker: { select: { name: true, paymentMethod: true } },
    },
  });
}
