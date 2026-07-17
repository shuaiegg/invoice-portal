import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InvoiceDetail } from "@/components/worker/invoice-detail";

export default async function InvoiceDetailsPage({
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
      worker: {
        include: {
          paymentAccounts: {
            orderBy: [{ isPreferred: "desc" }, { createdAt: "asc" }],
            take: 2,
          },
        },
      },
      lines: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Security check: must be owner or admin (session role — read-only page;
  // admin mutations are separately DB-checked in the API routes)
  const isOwner = invoice.worker.userId === session.user.id;
  const isAdmin = isOwner ? false : session.user.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    redirect("/dashboard");
  }

  return <InvoiceDetail invoice={invoice} isAdmin={isAdmin} />;
}
