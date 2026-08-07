import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { NewInvoiceForm } from "@/components/worker/new-invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import { isWorkerInvoiceEditable } from "@/lib/invoice-status";

export default async function AdminEditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (!isWorkerInvoiceEditable(invoice.status)) {
    redirect(`/admin/invoices/${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={`Edit Invoice ${invoice.invoiceNumber}`}
        subtitle={`Editing on behalf of ${invoice.worker.name} — saving will submit this invoice for review`}
      />
      <NewInvoiceForm worker={invoice.worker} initialData={invoice} />
    </div>
  );
}
