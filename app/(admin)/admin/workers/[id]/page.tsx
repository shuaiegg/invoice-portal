import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { AdminWorkerDetail } from "@/components/admin/admin-worker-detail";

export default async function AdminWorkerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const [worker, teamRows] = await Promise.all([
    db.worker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            active: true,
            createdAt: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
        },
        paymentAccounts: {
          orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
        },
      },
    }),
    db.worker.findMany({
      where: { team: { not: null } },
      select: { team: true },
      distinct: ["team"],
      orderBy: { team: "asc" },
    }),
  ]);

  if (!worker) {
    notFound();
  }

  const teams = teamRows.map((r) => r.team as string);

  return <AdminWorkerDetail worker={worker} teams={teams} />;
}
