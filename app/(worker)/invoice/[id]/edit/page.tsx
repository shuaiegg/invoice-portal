import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { NewInvoiceForm } from "@/components/worker/new-invoice-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function EditInvoicePage({
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
      lines: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Security check: only the owner can edit
  if (invoice.worker.userId !== session.user.id) {
    redirect("/dashboard");
  }

  // Status check: only SUBMITTED can be edited
  if (invoice.status !== "SUBMITTED") {
    redirect(`/invoice/${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader 
        title={`Edit Invoice ${invoice.invoiceNumber}`} 
        subtitle="Update your invoice details before it's approved"
      />
      <NewInvoiceForm worker={invoice.worker} initialData={invoice} />
    </div>
  );
}
