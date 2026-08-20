import { db } from "./db";
import { AnomalySeverity, AnomalyType, InvoiceStatus, PaymentType } from "./generated/client/enums";

export type AnomalyResult = {
  invoiceId: string | null;
  workerId: string;
  workerName: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  details: string;
};

/**
 * Runs all anomaly checks for a given billing month against already-generated DRAFT invoices.
 * Returns one AnomalyResult per detected anomaly. Does not write to DB — caller (automation-run)
 * is responsible for persisting AnomalyFlag records.
 */
export async function detectAnomalies(
  billingMonth: string,
  config: { hourDeviationThreshold: number; amountCeiling: number }
): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];

  // Load all DRAFT invoices for this billing month (supplementNo=0 only — primary invoices)
  const invoices = await db.invoice.findMany({
    where: { billingMonth, supplementNo: 0, status: InvoiceStatus.DRAFT },
    include: { worker: true },
  });

  for (const invoice of invoices) {
    const worker = invoice.worker;

    // ── Check 1: Amount ceiling (applies to all workers including new ones) ──────────────────
    if (invoice.totalAmount > config.amountCeiling) {
      anomalies.push({
        invoiceId: invoice.id,
        workerId: worker.id,
        workerName: worker.name,
        type: AnomalyType.AMOUNT_CEILING,
        severity: AnomalySeverity.HIGH,
        details: JSON.stringify({
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
          ceiling: config.amountCeiling,
          invoiceNumber: invoice.invoiceNumber,
        }),
      });
    }

    // ── Check 2: Hour deviation (skip workers with <3 months of history) ─────────────────────
    const [year, monthStr] = billingMonth.split("-");
    const priorMonths = getPrior3Months(Number(year), Number(monthStr));

    const priorInvoices = await db.invoice.findMany({
      where: {
        workerId: worker.id,
        billingMonth: { in: priorMonths },
        supplementNo: 0,
        status: { not: InvoiceStatus.VOID },
      },
      select: { quantity: true, billingMonth: true },
    });

    if (priorInvoices.length >= 3) {
      const avgHours =
        priorInvoices.reduce((sum, inv) => sum + inv.quantity, 0) / priorInvoices.length;

      if (avgHours > 0) {
        const deviation = Math.abs(invoice.quantity - avgHours) / avgHours;
        if (deviation > config.hourDeviationThreshold) {
          anomalies.push({
            invoiceId: invoice.id,
            workerId: worker.id,
            workerName: worker.name,
            type: AnomalyType.HOUR_DEVIATION,
            severity: AnomalySeverity.HIGH,
            details: JSON.stringify({
              currentHours: invoice.quantity,
              avgHours: Math.round(avgHours * 100) / 100,
              deviationPct: Math.round(deviation * 100),
              threshold: Math.round(config.hourDeviationThreshold * 100),
              invoiceNumber: invoice.invoiceNumber,
            }),
          });
        }
      }
    }
  }

  // ── Check 3: Missing TD data (TD_ONLY workers with no invoice this month) ─────────────────
  const tdOnlyWorkers = await db.worker.findMany({
    where: { paymentType: PaymentType.TD_ONLY },
    select: { id: true, name: true },
  });

  const invoicedWorkerIds = new Set(invoices.map((inv) => inv.workerId));

  for (const worker of tdOnlyWorkers) {
    if (!invoicedWorkerIds.has(worker.id)) {
      anomalies.push({
        invoiceId: null,
        workerId: worker.id,
        workerName: worker.name,
        type: AnomalyType.MISSING_TD_DATA,
        severity: AnomalySeverity.MEDIUM,
        details: JSON.stringify({
          billingMonth,
          reason: "TD_ONLY worker has no invoice for this month",
        }),
      });
    }
  }

  return anomalies;
}

/** Returns the billing month strings for the 3 months immediately before the given month. */
function getPrior3Months(year: number, month: number): string[] {
  const months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    let m = month - i;
    let y = year;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}
