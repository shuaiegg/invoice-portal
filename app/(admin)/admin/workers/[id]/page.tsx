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

  const worker = await db.worker.findUnique({
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
    },
  });

  if (!worker) {
    notFound();
  }

  return <AdminWorkerDetail worker={worker} />;
}
