import { db } from "./db";
import { runTdSync } from "./td-sync";
import { detectAnomalies } from "./anomaly-detector";
import { AutomationRunStatus } from "./generated/client/enums";

const DEFAULT_CONFIG = { hourDeviationThreshold: 0.2, amountCeiling: 10000 };

/**
 * Monthly automation chain:
 *   1. TD sync (generates DRAFT invoices)
 *   2. Anomaly detection
 *   3. Persist AnomalyFlag records (informational — do not block flow)
 *   4. Mark run COMPLETED
 *
 * Anomalies are visible on /admin/automation for finance to review before
 * approving invoices. They do not block the run from completing.
 *
 * Prevents duplicate runs: if a non-FAILED run already exists for the billing
 * month, returns it without re-running.
 */
export async function runAutomation({
  year,
  month,
  triggeredBy = "cron",
}: {
  year: number;
  month: number;
  triggeredBy?: string;
}) {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

  const existing = await db.automationRun.findFirst({
    where: { billingMonth, status: { not: AutomationRunStatus.FAILED } },
  });
  if (existing) return existing;

  const automationRun = await db.automationRun.create({
    data: { billingMonth, triggeredBy, status: AutomationRunStatus.RUNNING },
  });

  try {
    await runTdSync({ year, month, triggeredBy });

    const savedConfig = await db.automationConfig.findUnique({ where: { id: "singleton" } });
    const config = savedConfig ?? DEFAULT_CONFIG;

    const anomalies = await detectAnomalies(billingMonth, config);

    if (anomalies.length > 0) {
      await db.anomalyFlag.createMany({
        data: anomalies.map((a) => ({
          runId: automationRun.id,
          invoiceId: a.invoiceId,
          workerId: a.workerId,
          type: a.type,
          severity: a.severity,
          details: a.details,
        })),
      });
    }

    return await db.automationRun.update({
      where: { id: automationRun.id },
      data: { status: AutomationRunStatus.COMPLETED, completedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.automationRun.update({
      where: { id: automationRun.id },
      data: { status: AutomationRunStatus.FAILED, errorLog: message },
    });
    throw error;
  }
}
