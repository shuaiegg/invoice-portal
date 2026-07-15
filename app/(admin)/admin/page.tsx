import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, FileText, Users } from "lucide-react";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { SettlementMonthSelect } from "@/components/admin/settlement-month-select";
import { StatsCard } from "@/components/admin/stats-card";
import { TdSyncPanel } from "@/components/admin/td-sync-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { InvoiceStatus } from "@/lib/generated/client/client";
import { currencyTotalsFromGroups, formatCurrencyTotals } from "@/lib/money";
import { isSettlementComplete, previousParisBillingMonth } from "@/lib/settlement";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const defaultMonth = previousParisBillingMonth();
  const billingMonth = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : defaultMonth;

  const [
    statusGroups,
    totalsGroups,
    paidGroups,
    unresolvedFailures,
    xeroFailed,
    availableMonthRows,
    activeWorkers,
    recentActivity,
    syncRuns,
    syncFailures,
    syncWorkers,
  ] = await Promise.all([
    db.invoice.groupBy({ by: ["status"], where: { billingMonth }, _count: { _all: true } }),
    db.invoice.groupBy({ by: ["currency"], where: { billingMonth }, _sum: { totalAmount: true } }),
    db.invoice.groupBy({ by: ["currency"], where: { billingMonth, status: "PAID" }, _sum: { totalAmount: true } }),
    db.tdMatchFailure.count({
      where: { resolved: false, syncRun: { invoices: { some: { billingMonth } } } },
    }),
    db.invoice.count({ where: { billingMonth, status: "PAID", xeroSynced: false } }),
    db.invoice.findMany({
      where: { billingMonth: { not: null } },
      distinct: ["billingMonth"],
      select: { billingMonth: true },
      orderBy: { billingMonth: "desc" },
    }),
    db.worker.count({ where: { user: { active: true } } }),
    db.invoice.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { worker: { select: { name: true } } } }),
    db.tdSyncRun.findMany({ orderBy: { runAt: "desc" }, take: 12 }),
    db.tdMatchFailure.findMany({ where: { resolved: false }, orderBy: { syncRun: { runAt: "desc" } } }),
    db.worker.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const actorIds = syncRuns.flatMap((run) => run.triggeredBy ? [run.triggeredBy] : []);
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));
  const statusCounts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])) as Partial<Record<InvoiceStatus, number>>;
  const invoiceCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const nonVoidCount = invoiceCount - (statusCounts.VOID ?? 0);
  const paidCount = statusCounts.PAID ?? 0;
  const complete = isSettlementComplete(statusCounts, unresolvedFailures);
  const totalLabel = formatCurrencyTotals(currencyTotalsFromGroups(totalsGroups));
  const paidLabel = formatCurrencyTotals(currencyTotalsFromGroups(paidGroups));
  const availableMonths = [...new Set([
    billingMonth,
    ...availableMonthRows.flatMap((row) => row.billingMonth ? [row.billingMonth] : []),
  ])].sort().reverse();
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${billingMonth}-02`));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Admin Overview" subtitle={`Settlement workspace for ${monthLabel}`} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>{monthLabel} settlement</CardTitle>
              <Badge variant={complete ? "default" : "secondary"}>{complete ? "Complete" : "In progress"}</Badge>
            </div>
            <CardDescription>{paidCount} of {nonVoidCount} non-void invoices paid · {unresolvedFailures} unresolved matches</CardDescription>
          </div>
          <SettlementMonthSelect months={availableMonths} value={billingMonth} />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-sm text-muted-foreground">Invoices</p><p className="text-2xl font-semibold">{invoiceCount}</p></div>
            <div><p className="text-sm text-muted-foreground">Month total</p><p className="text-2xl font-semibold">{totalLabel || "—"}</p></div>
            <div><p className="text-sm text-muted-foreground">Unresolved matches</p><p className="text-2xl font-semibold">{unresolvedFailures}</p></div>
            <div><p className="text-sm text-muted-foreground">Xero failed</p><p className="text-2xl font-semibold">{xeroFailed}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["DRAFT", "SUBMITTED", "APPROVED", "PAID", "VOID"] as InvoiceStatus[]).map((status) => (
              <Badge key={status} variant="outline">{status}: {statusCounts[status] ?? 0}</Badge>
            ))}
          </div>
          <Button className="self-start" variant="outline" asChild><Link href={`/admin/invoices?month=${billingMonth}`}>Open invoice list</Link></Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Invoices This Month" value={invoiceCount} icon={<FileText />} subtitle={`Billing month ${billingMonth}`} />
        <StatsCard title="Pending Approval" value={statusCounts.SUBMITTED ?? 0} icon={<Clock />} subtitle="Invoices awaiting review" />
        <StatsCard title="Paid This Month" value={paidLabel || "—"} icon={<CheckCircle2 />} subtitle={`Billing month ${billingMonth}`} />
        <StatsCard title="Active Workers" value={activeWorkers} icon={<Users />} subtitle="Registered and active accounts" />
      </div>

      <TdSyncPanel
        runs={syncRuns.map((run) => ({ ...run, runAt: run.runAt.toISOString(), triggeredByName: run.triggeredBy ? actorNames.get(run.triggeredBy) || "Admin" : "Cron" }))}
        failures={syncFailures.map(({ id, tdName, tdEmail }) => ({ id, tdName, tdEmail }))}
        workers={syncWorkers}
      />

      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold tracking-tight">Recent Activity</h2>
        <ActivityFeed invoices={recentActivity} />
      </div>
    </div>
  );
}
