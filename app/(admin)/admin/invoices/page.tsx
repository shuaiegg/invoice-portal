import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AdminInvoiceTable } from "@/components/admin/admin-invoice-table";
import { InvoiceFilters } from "@/components/admin/invoice-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/client/client";
import { currencyTotalsFromGroups, formatCurrencyTotals } from "@/lib/money";
import {
  PAYMENT_CHANNEL_LABELS,
  PAYMENT_CHANNELS,
  deriveChannel,
  filterWorkerIdsByChannel,
  parsePaymentChannel,
  type PaymentChannel,
} from "@/lib/payment-channel";
import { resolveWorkerChannelMap } from "@/lib/payment-channel-server";

type SearchParams = { [key: string]: string | string[] | undefined };

function channelHref(params: SearchParams, channel: PaymentChannel | null) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "channel" || key === "page" || value === undefined) continue;
    next.set(key, Array.isArray(value) ? value[0] : value);
  }
  if (channel) next.set("channel", channel.toLowerCase());
  return `/admin/invoices?${next.toString()}`;
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  // Duplicate query params arrive as arrays — always take the first value
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = first(params.status)?.split(",").filter(Boolean);
  const period = first(params.period);
  const workerName = first(params.workerName);
  const month = first(params.month);
  const xero = first(params.xero);
  const channel = parsePaymentChannel(first(params.channel));
  const page = parseInt(first(params.page) || "1");
  // ~260 workers → a whole settlement month fits on one page; 500 is a safety cap
  // so the unfiltered all-time view can't grow unbounded, not a browsing unit.
  const limit = 500;

  const baseWhere: Prisma.InvoiceWhereInput = {};
  if (status?.length) baseWhere.status = { in: status as Prisma.EnumInvoiceStatusFilter["in"] };
  if (period) baseWhere.period = { contains: period, mode: "insensitive" };
  if (workerName) baseWhere.worker = { name: { contains: workerName, mode: "insensitive" } };
  if (month && /^\d{4}-\d{2}$/.test(month)) baseWhere.billingMonth = month;
  if (xero === "failed") Object.assign(baseWhere, { status: "PAID", xeroSynced: false });

  const baseInvoices = await db.invoice.findMany({
    where: baseWhere,
    select: { workerId: true },
  });
  const workerChannels = await resolveWorkerChannelMap([...new Set(baseInvoices.map((invoice) => invoice.workerId))]);
  const channelCounts: Record<PaymentChannel, number> = { WISE: 0, PAYPAL: 0, MANUAL: 0 };
  for (const invoice of baseInvoices) channelCounts[workerChannels.get(invoice.workerId) ?? "MANUAL"] += 1;

  const where: Prisma.InvoiceWhereInput = { ...baseWhere };
  if (channel) {
    where.workerId = { in: filterWorkerIdsByChannel(workerChannels, channel) };
  }

  const [invoices, total, totalsByCurrency, availableMonths] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        worker: {
          select: {
            name: true,
            team: true,
            paymentMethod: true,
            paymentAccounts: { select: { type: true, isPreferred: true } },
          },
        },
      },
    }),
    db.invoice.count({ where }),
    db.invoice.groupBy({ by: ["currency"], where, _sum: { totalAmount: true } }),
    db.invoice.findMany({
      where: { billingMonth: { not: null } },
      distinct: ["billingMonth"],
      select: { billingMonth: true },
      orderBy: { billingMonth: "desc" },
    }),
  ]);

  const exportParams = new URLSearchParams();
  for (const key of ["status", "period", "workerName", "month", "channel", "xero"] as const) {
    const value = params[key];
    if (typeof value === "string") exportParams.set(key, value);
  }
  const monthLabel = month
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-02`))
    : null;
  const totalsLabel = formatCurrencyTotals(currencyTotalsFromGroups(totalsByCurrency));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Manage Invoices"
        subtitle={month
          ? `${monthLabel}: ${total} invoice${total === 1 ? "" : "s"}${totalsLabel ? ` · ${totalsLabel}` : ""}`
          : "Review, approve, and track payment status of all worker invoices"}
        action={
          <a href={`/api/admin/invoices/export?${exportParams.toString()}`} download>
            <Button variant="outline"><Download data-icon="inline-start" />Export CSV</Button>
          </a>
        }
      />

      <Tabs value={channel ?? "all"}>
        <TabsList>
          <TabsTrigger value="all" asChild><Link href={channelHref(params, null)}>All ({baseInvoices.length})</Link></TabsTrigger>
          {PAYMENT_CHANNELS.map((item) => (
            <TabsTrigger key={item} value={item} asChild>
              <Link href={channelHref(params, item)}>{PAYMENT_CHANNEL_LABELS[item]} ({channelCounts[item]})</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <InvoiceFilters availableMonths={availableMonths.flatMap((row) => row.billingMonth ? [row.billingMonth] : [])} />
      <AdminInvoiceTable
        invoices={invoices.map((invoice) => ({ ...invoice, channel: deriveChannel(invoice.worker) }))}
        total={total}
        page={page}
        pageSize={limit}
        totalPages={Math.ceil(total / limit)}
      />
    </div>
  );
}
