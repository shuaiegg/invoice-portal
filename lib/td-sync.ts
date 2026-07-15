import { Prisma } from "./generated/client/client";
import { db } from "./db";
import { reserveInvoiceNumbers } from "./invoice-number";
import { tdPlusDraftReady, tdSyncFailure, tdSyncSummary } from "./slack";
import { fetchMonthlyHours, hoursFromSeconds } from "./timedoctor";
import { buildTdWorkerMatcher } from "./td-worker-matching";

export type TdSyncOptions = { year: number; month: number; triggeredBy?: string | null };

export async function runTdSync({ year, month, triggeredBy = null }: TdSyncOptions) {
  const run = await db.tdSyncRun.create({ data: { triggeredBy } });
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const invoiceDate = new Date(Date.UTC(year, month, 0));
  const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  let invoicesCreated = 0;
  let matchFailed = 0;
  let inactiveSkipped = 0;
  let ignoredSkipped = 0;
  let totalAmount = 0;
  const errors: string[] = [];

  try {
    const totals = await fetchMonthlyHours(year, month);
    const workers = await db.worker.findMany({
      include: { user: { select: { email: true, active: true } } },
    });
    const workerMatcher = buildTdWorkerMatcher(workers);
    type PendingInvoice = {
      worker: (typeof workers)[number];
      quantity: number;
      subtotal: number;
      vatAmount: number;
      total: number;
      rate: number;
      currency: string; // already validated non-null below — kept separately so it stays narrowed
    };

    // Batched up front — with 200+ TD users, checking each individually turned the sync into
    // hundreds of sequential round trips (this is what made it slow enough to worry about
    // Vercel's execution limit). Both of these are single queries regardless of company size.
    const ignoredEmails = new Set(
      (await db.tdIgnoredEmail.findMany({ select: { email: true } })).map((row) => row.email.toLowerCase()),
    );
    const existingInvoiceWorkerIds = new Set(
      (await db.invoice.findMany({ where: { billingMonth }, select: { workerId: true } })).map((row) => row.workerId),
    );

    // First pass: classify every TD user and compute amounts for the ones that need a new
    // invoice, without writing anything yet — lets us reserve exactly the right number of
    // invoice numbers in one batched call instead of one atomic increment per invoice.
    const pending: PendingInvoice[] = [];
    for (const tdUser of totals) {
      const match = workerMatcher.match(tdUser.email);
      if (match.kind === "inactive") {
        inactiveSkipped += 1;
        continue;
      }
      if (match.kind === "unmatched") {
        if (ignoredEmails.has(tdUser.email.toLowerCase())) {
          ignoredSkipped += 1;
          continue;
        }
        await db.tdMatchFailure.create({ data: {
          syncRunId: run.id, tdUserId: tdUser.userId, tdEmail: tdUser.email, tdName: tdUser.name,
        } });
        matchFailed += 1;
        continue;
      }
      const activeWorker = match.worker;
      if (activeWorker.paymentType === "MANUAL") continue;
      if (activeWorker.hourlyRate === null || !activeWorker.currency) {
        await db.tdMatchFailure.create({ data: {
          syncRunId: run.id, tdUserId: tdUser.userId, tdEmail: tdUser.email,
          tdName: `${tdUser.name} (missing rate or currency)`,
        } });
        matchFailed += 1;
        continue;
      }
      if (existingInvoiceWorkerIds.has(activeWorker.id)) continue;

      const quantity = hoursFromSeconds(tdUser.totalSec);
      const subtotal = Math.round(quantity * activeWorker.hourlyRate * 100) / 100;
      const vatAmount = Math.round(subtotal * (activeWorker.vatRate / 100) * 100) / 100;
      pending.push({
        worker: activeWorker, quantity, subtotal, vatAmount,
        total: subtotal + vatAmount, rate: activeWorker.hourlyRate, currency: activeWorker.currency,
      });
    }

    const invoiceNumbers = await reserveInvoiceNumbers(year, pending.length);
    const description = `${billingMonth} hours — Time Doctor`;

    for (let i = 0; i < pending.length; i += 1) {
      const { worker: activeWorker, quantity, subtotal, vatAmount, total, rate, currency } = pending[i];
      try {
        const invoice = await db.invoice.create({ data: {
          workerId: activeWorker.id,
          tdSyncRunId: run.id,
          billingMonth,
          invoiceNumber: invoiceNumbers[i],
          invoiceDate,
          dueDate,
          serviceDate: invoiceDate,
          status: activeWorker.paymentType === "TD_PLUS" ? "DRAFT" : "SUBMITTED",
          description,
          period: billingMonth,
          quantity,
          rate,
          subtotal,
          vatAmount,
          totalAmount: total,
          vatRate: activeWorker.vatRate,
          currency,
          lines: { create: { description, quantity, unitRate: rate, amount: subtotal } },
        } });
        invoicesCreated += 1;
        totalAmount += total;
        if (activeWorker.paymentType === "TD_PLUS") tdPlusDraftReady(invoice, activeWorker);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        errors.push(`${activeWorker.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const status = errors.length || matchFailed ? "PARTIAL" : "SUCCESS";
    const result = { invoicesCreated, matchFailed, inactiveSkipped, ignoredSkipped, totalAmount };
    await Promise.all([
      db.tdSyncRun.update({ where: { id: run.id }, data: { ...result, status, errorLog: errors.join("\n") || null } }),
      db.timeDoctorConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date(), lastSyncStatus: status } }),
    ]);
    tdSyncSummary(result);
    return { id: run.id, status, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.tdSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorLog: message } });
    await db.timeDoctorConfig.updateMany({ where: { id: "singleton" }, data: { lastSyncAt: new Date(), lastSyncStatus: "FAILED" } });
    tdSyncFailure();
    throw error;
  }
}
