import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { AutomationPanel } from "@/components/admin/automation-panel";
import { previousParisBillingMonth } from "@/lib/settlement";

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const defaultMonth = previousParisBillingMonth();
  const billingMonth =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : defaultMonth;
  const [year, month] = billingMonth.split("-").map(Number);

  const [run, report] = await Promise.all([
    db.automationRun.findFirst({
      where: { billingMonth },
      orderBy: { createdAt: "desc" },
      include: {
        anomalyFlags: {
          orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
          include: {
            worker: { select: { name: true } },
            invoice: { select: { invoiceNumber: true } },
          },
        },
      },
    }),
    db.monthlyReport.findUnique({ where: { year_month: { year, month } } }),
  ]);

  const runData = run
    ? {
        id: run.id,
        billingMonth: run.billingMonth,
        status: run.status,
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        anomalyFlags: run.anomalyFlags.map((f) => ({
          id: f.id,
          type: f.type,
          severity: f.severity,
          details: f.details,
          workerName: f.worker?.name ?? null,
          invoiceNumber: f.invoice?.invoiceNumber ?? null,
        })),
      }
    : null;

  const reportData = report
    ? {
        year: report.year,
        month: report.month,
        totalAmount: report.totalAmount,
        workerCount: report.workerCount,
        currencyBreakdown: report.currencyBreakdown as Record<string, number>,
        xeroStatus: report.xeroStatus,
        generatedAt: report.generatedAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Operations"
        subtitle="Automation run status, anomaly report, and monthly finance report — all in one place."
      />
      <AutomationPanel
        billingMonth={billingMonth}
        availableMonths={getLast12Months()}
        run={runData}
        report={reportData}
      />
    </div>
  );
}
