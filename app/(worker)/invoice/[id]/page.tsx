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
      worker: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  // Security check: must be owner or admin
  const isOwner = invoice.worker.userId === session.user.id;
  const isAdmin = (session.user as any).role === "ADMIN";

  if (!isOwner && !isAdmin) {
    redirect("/dashboard");
  }

  return <InvoiceDetail invoice={invoice} isAdmin={isAdmin} />;
}
