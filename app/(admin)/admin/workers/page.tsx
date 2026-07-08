import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AdminWorkerList } from "@/components/admin/admin-worker-list";
import { Prisma } from "@/lib/generated/client/client";

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

  const where: Prisma.WorkerWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { team: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const workers = await db.worker.findMany({
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
  });

  const formattedWorkers = workers.map((w) => ({
    id: w.id,
    name: w.name,
    team: w.team,
    email: w.user.email,
    active: w.user.active,
    paymentType: w.paymentType,
    timeDoctorEmail: w.timeDoctorEmail,
    invoiceCount: w._count.invoices,
    lastSubmission: w.invoices[0]?.invoiceDate || null,
    joinedAt: w.user.createdAt,
  }));

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Worker Management" 
        subtitle="Manage worker accounts and view their submission history"
      />

      <AdminWorkerList workers={formattedWorkers} />
    </div>
  );
}
