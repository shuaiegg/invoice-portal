import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AdminWorkerList } from "@/components/admin/admin-worker-list";
import { AddWorkerDialog } from "@/components/admin/add-worker-dialog";
import { Prisma } from "@/lib/generated/client/client";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/admin/stats-card";
import { Upload, Users, UserCheck, Clock } from "lucide-react";
import Link from "next/link";

export default async function AdminWorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search as string;
  const paymentMethod = params.paymentMethod as string;

  const where: Prisma.WorkerWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { team: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { timeDoctorEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  if (paymentMethod) {
    where.paymentMethod = { equals: paymentMethod, mode: "insensitive" };
  }

  const [workers, totalCount, activeCount, pendingCount] = await Promise.all([
    db.worker.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            active: true,
            createdAt: true,
          },
        },
        _count: {
          select: { invoices: true },
        },
        invoices: {
          take: 1,
          orderBy: { invoiceDate: "desc" },
          select: { invoiceDate: true },
        },
      },
      orderBy: {
        user: { createdAt: "desc" },
      },
    }),
    // Unfiltered totals — always reflect the whole company, not the current search.
    db.worker.count(),
    db.worker.count({ where: { user: { active: true } } }),
    db.worker.count({ where: { userId: null } }),
  ]);

  const formattedWorkers = workers.map((w) => ({
    id: w.id,
    name: w.name,
    team: w.team,
    email: w.user?.email ?? w.timeDoctorEmail,
    active: w.user?.active ?? false,
    claimed: Boolean(w.userId),
    paymentType: w.paymentType,
    paymentMethod: w.paymentMethod,
    timeDoctorEmail: w.timeDoctorEmail,
    invoiceCount: w._count.invoices,
    lastSubmission: w.invoices[0]?.invoiceDate || null,
    joinedAt: w.user?.createdAt ?? w.createdAt,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Worker Management"
        subtitle="Manage worker accounts and view their submission history"
        action={
          <div className="flex gap-2">
            <AddWorkerDialog />
            <Link href="/admin/workers/import">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import from Time Doctor
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Total Workers" value={totalCount} icon={<Users className="h-4 w-4" />} />
        <StatsCard title="Active" value={activeCount} icon={<UserCheck className="h-4 w-4 text-success" />} />
        <StatsCard title="Pending Registration" value={pendingCount} icon={<Clock className="h-4 w-4 text-warning" />} />
      </div>

      <AdminWorkerList workers={formattedWorkers} />
    </div>
  );
}
