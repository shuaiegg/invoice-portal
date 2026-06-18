import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/admin/stats-card";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { FileText, Clock, CheckCircle2, Users } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [stats, recentActivity] = await Promise.all([
    // Aggregate Stats
    Promise.all([
      db.invoice.count({
        where: { invoiceDate: { gte: firstDayOfMonth } },
      }),
      db.invoice.count({
        where: { status: "SUBMITTED" },
      }),
      db.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { status: "PAID", invoiceDate: { gte: firstDayOfMonth } },
      }),
      db.worker.count({
        where: { user: { active: true } },
      }),
    ]),
    // Recent Activity
    db.invoice.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        worker: {
          select: { name: true },
        },
      },
    }),
  ]);

  const [invoicesThisMonth, pendingCount, paidSum, activeWorkers] = stats;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const monthName = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
  }).format(now);

  return (
    <div className="space-y-10">
      <PageHeader 
        title="Admin Overview" 
        subtitle={`Summary for ${monthName} ${now.getFullYear()}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Invoices This Month"
          value={invoicesThisMonth}
          icon={<FileText className="h-4 w-4" />}
          subtitle="Total submitted across all workers"
        />
        <StatsCard
          title="Pending Approval"
          value={pendingCount}
          icon={<Clock className="h-4 w-4 text-warning" />}
          subtitle="Invoices awaiting review"
        />
        <StatsCard
          title="Paid This Month"
          value={formatCurrency(paidSum._sum.totalAmount || 0)}
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          subtitle="Total amount in PAID status"
        />
        <StatsCard
          title="Active Workers"
          value={activeWorkers}
          icon={<Users className="h-4 w-4 text-primary" />}
          subtitle="Registered and active accounts"
        />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Recent Activity</h2>
        <ActivityFeed invoices={recentActivity} />
      </div>
    </div>
  );
}
