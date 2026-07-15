import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceFilters } from "@/components/admin/invoice-filters";
import { AdminInvoiceTable } from "@/components/admin/admin-invoice-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Prisma } from "@/lib/generated/client/client";

export default async function AdminInvoicesPage({
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

  // Parse filters from URL
  const status = params.status ? (params.status as string).split(",") : undefined;
  const period = params.period as string;
  const workerName = params.workerName as string;
  const month = params.month as string; // "YYYY-MM", filters by invoiceDate

  // Pagination
  const page = parseInt((params.page as string) || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceWhereInput = {};
  const workerFilter: Prisma.WorkerWhereInput = {};

  if (status && status.length > 0) {
    where.status = { in: status as any };
  }
  if (period) {
    where.period = { contains: period, mode: "insensitive" };
  }
  if (workerName) {
    workerFilter.name = { contains: workerName, mode: "insensitive" };
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    where.invoiceDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  }

  if (Object.keys(workerFilter).length > 0) {
    where.worker = workerFilter;
  }

  const [invoices, total, monthSum, availableMonths] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        worker: {
          select: {
            name: true,
            team: true,
          },
        },
      },
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({ where, _sum: { totalAmount: true } }),
    db.$queryRaw<{ month: string }[]>`
      SELECT DISTINCT to_char("invoiceDate", 'YYYY-MM') AS month FROM "Invoice" ORDER BY month DESC
    `,
  ]);

  const totalPages = Math.ceil(total / limit);

  // Construct export URL
  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status.join(","));
  if (period) exportParams.set("period", period);
  if (workerName) exportParams.set("workerName", workerName);
  if (month) exportParams.set("month", month);

  const monthLabel = month
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-02`))
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage Invoices"
        subtitle={
          month
            ? `${monthLabel}: ${total} invoice${total === 1 ? "" : "s"} · €${(monthSum._sum.totalAmount ?? 0).toFixed(2)}`
            : "Review, approve, and track payment status of all worker invoices"
        }
        action={
          <a href={`/api/admin/invoices/export?${exportParams.toString()}`} download>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </a>
        }
      />

      <InvoiceFilters availableMonths={availableMonths.map((row) => row.month)} />

      <AdminInvoiceTable
        invoices={invoices}
        total={total}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
