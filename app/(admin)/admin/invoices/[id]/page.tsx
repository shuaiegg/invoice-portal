import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { AdminInvoiceDetail } from "@/components/admin/admin-invoice-detail";

export default async function AdminInvoiceDetailsPage({
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

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { order: "asc" },
      },
      worker: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  return <AdminInvoiceDetail invoice={invoice} />;
}
