import { Prisma } from "./generated/client/client";
import { db } from "./db";
import { reserveInvoiceNumbers } from "./invoice-number";
import { tdPlusDraftReady, tdSyncFailure, tdSyncSummary } from "./slack";
import { calculateInvoiceAmounts } from "./invoice-lines";
import { fetchMonthlyHours, hoursFromSeconds } from "./timedoctor";
import { buildTdWorkerMatcher } from "./td-worker-matching";

export type TdSyncOptions = { year: number; month: number; triggeredBy?: string | null };

export type TdInvoiceWorker = {
  id: string;
  name: string;
  hourlyRate: number;
  currency: string;
  vatRate: number;
  paymentType: string;
};

// Builds the full Invoice create-data for one worker's TD-tracked hours in one billing month.
// Shared by the main sync loop (batched invoice numbers, tdSyncRunId set) and TD sync failure
// resolution (single invoice number per backfill, no tdSyncRunId — the invoice wasn't produced
// by a sync run, it's a delayed backfill). invoiceDate/dueDate are derived from `year`/`month`,
// not "now" — a failure resolved weeks later still gets the historically-correct invoice date.
export function buildTdInvoiceData({
  worker,
  year,
  month,
  quantity,
  invoiceNumber,
  tdSyncRunId = null,
}: {
  worker: TdInvoiceWorker;
  year: number;
  month: number;
  quantity: number;
  invoiceNumber: string;
  tdSyncRunId?: string | null;
}) {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const invoiceDate = new Date(Date.UTC(year, month, 0));
  const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const description = `${billingMonth} hours — Time Doctor`;

  // TD hourly rates are VAT-inclusive: hours × rate is the gross the worker is
  // paid, and any VAT is carved out of it — never added on top.
  const gross = Math.round(quantity * worker.hourlyRate * 100) / 100;
  const amounts = calculateInvoiceAmounts(gross, worker.vatRate, true);
  const subtotal = Math.round(amounts.subtotal * 100) / 100;
  const vatAmount = Math.round((gross - subtotal) * 100) / 100;

  return {
    workerId: worker.id,
    tdSyncRunId,
    billingMonth,
    invoiceNumber,
    invoiceDate,
    dueDate,
    serviceDate: invoiceDate,
    status: worker.paymentType === "TD_PLUS" ? ("DRAFT" as const) : ("SUBMITTED" as const),
    description,
    period: billingMonth,
    quantity,
    rate: worker.hourlyRate,
    subtotal,
    vatAmount,
    totalAmount: gross,
    vatRate: worker.vatRate,
    vatInclusive: true,
    currency: worker.currency,
    lines: { create: { description, quantity, unitRate: worker.hourlyRate, amount: gross } },
  };
}

export async function runTdSync({ year, month, triggeredBy = null }: TdSyncOptions) {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const run = await db.tdSyncRun.create({ data: { triggeredBy, billingMonth } });
  let invoicesCreated = 0;
  let skippedExisting = 0;
  let matchFailed = 0;
  let inactiveSkipped = 0;
  let ignoredSkipped = 0;
  let totalAmount = 0;
  const totalsByCurrency: Record<string, number> = {};
  const errors: string[] = [];

  try {
    const totals = await fetchMonthlyHours(year, month);
    const workers = await db.worker.findMany({
      include: { user: { select: { email: true, active: true } } },
    });
    const workerMatcher = buildTdWorkerMatcher(workers);
    type PendingInvoice = {
      worker: TdInvoiceWorker;
      quantity: number;
    };
    type PendingFailure = {
      tdUserId: string;
      tdEmail: string;
      tdName: string;
      reason: "UNMATCHED" | "NEEDS_SETUP" | "MISSING_RATE";
      workerId: string | null;
      quantity: number;
    };

    // Batched up front — with 200+ TD users, checking each individually turned the sync into
    // hundreds of sequential round trips (this is what made it slow enough to worry about
    // Vercel's execution limit). Both of these are single queries regardless of company size.
    const ignoredEmails = new Set(
      (await db.tdIgnoredEmail.findMany({ select: { email: true } })).map((row) => row.email.toLowerCase()),
    );
    // Primaries only: a worker-created supplement must not block the month's primary invoice
    const existingInvoiceWorkerIds = new Set(
      (await db.invoice.findMany({ where: { billingMonth, supplementNo: 0 }, select: { workerId: true } })).map((row) => row.workerId),
    );

    // First pass: classify every TD user and compute amounts for the ones that need a new
    // invoice, without writing anything yet — lets us reserve exactly the right number of
    // invoice numbers in one batched call instead of one atomic increment per invoice.
    const pending: PendingInvoice[] = [];
    const pendingFailures: PendingFailure[] = [];
    for (const tdUser of totals) {
      const match = workerMatcher.match(tdUser.email);
      const quantity = hoursFromSeconds(tdUser.totalSec);
      if (match.kind === "inactive") {
        inactiveSkipped += 1;
        continue;
      }
      if (match.kind === "unmatched") {
        if (ignoredEmails.has(tdUser.email.toLowerCase())) {
          ignoredSkipped += 1;
          continue;
        }
        pendingFailures.push({
          tdUserId: tdUser.userId, tdEmail: tdUser.email, tdName: tdUser.name,
          reason: "UNMATCHED", workerId: null, quantity,
        });
        matchFailed += 1;
        continue;
      }
      const activeWorker = match.worker;
      if (activeWorker.paymentType === "MANUAL") {
        // A deliberately-configured Manual worker (admin chose it, or it came in via an import
        // that always sets a non-MANUAL paymentType) self-reports every invoice line by hand —
        // Worker.hourlyRate is never used for them, so there's nothing to flag. A worker who's
        // still sitting on the schema default (never touched by CSV import or an admin) is
        // indistinguishable from that at the paymentType level alone, which is exactly what
        // paymentConfigured disambiguates: flag those as needing setup instead of skipping silently.
        if (activeWorker.paymentConfigured) continue;
        pendingFailures.push({
          tdUserId: tdUser.userId, tdEmail: tdUser.email, tdName: tdUser.name,
          reason: "NEEDS_SETUP", workerId: activeWorker.id, quantity,
        });
        matchFailed += 1;
        continue;
      }
      if (activeWorker.hourlyRate === null || !activeWorker.currency) {
        pendingFailures.push({
          tdUserId: tdUser.userId, tdEmail: tdUser.email, tdName: tdUser.name,
          reason: "MISSING_RATE", workerId: activeWorker.id, quantity,
        });
        matchFailed += 1;
        continue;
      }
      if (existingInvoiceWorkerIds.has(activeWorker.id)) {
        skippedExisting += 1;
        continue;
      }

      pending.push({
        worker: {
          id: activeWorker.id, name: activeWorker.name, hourlyRate: activeWorker.hourlyRate, currency: activeWorker.currency,
          vatRate: activeWorker.vatRate, paymentType: activeWorker.paymentType,
        },
        quantity,
      });
    }

    if (pendingFailures.length) {
      await db.tdMatchFailure.createMany({
        data: pendingFailures.map((f) => ({
          syncRunId: run.id, tdUserId: f.tdUserId, tdEmail: f.tdEmail, tdName: f.tdName,
          reason: f.reason, workerId: f.workerId, billingMonth, quantity: f.quantity,
        })),
      });
    }

    const invoiceNumbers = await reserveInvoiceNumbers(year, pending.length);

    for (let i = 0; i < pending.length; i += 1) {
      const { worker: activeWorker, quantity } = pending[i];
      try {
        const invoice = await db.invoice.create({
          data: buildTdInvoiceData({
            worker: activeWorker, year, month, quantity, invoiceNumber: invoiceNumbers[i], tdSyncRunId: run.id,
          }),
        });
        invoicesCreated += 1;
        totalAmount += invoice.totalAmount;
        totalsByCurrency[invoice.currency] = (totalsByCurrency[invoice.currency] ?? 0) + invoice.totalAmount;
        if (activeWorker.paymentType === "TD_PLUS") tdPlusDraftReady(invoice, activeWorker);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        errors.push(`${activeWorker.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const status = errors.length || matchFailed ? "PARTIAL" : "SUCCESS";
    const result = { invoicesCreated, skippedExisting, matchFailed, inactiveSkipped, ignoredSkipped, totalAmount };
    await Promise.all([
      db.tdSyncRun.update({ where: { id: run.id }, data: { ...result, status, errorLog: errors.join("\n") || null } }),
      db.timeDoctorConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date(), lastSyncStatus: status } }),
    ]);
    tdSyncSummary({ ...result, totalsByCurrency });
    return { id: run.id, status, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.tdSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorLog: message } });
    await db.timeDoctorConfig.updateMany({ where: { id: "singleton" }, data: { lastSyncAt: new Date(), lastSyncStatus: "FAILED" } });
    tdSyncFailure();
    throw error;
  }
}
