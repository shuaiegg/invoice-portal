import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AuditLogTable } from "@/components/admin/audit-log-table";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { page: pageParam, action } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));

  const where = action ? { action } : undefined;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  const serialized = logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
    details: log.details as Record<string, unknown>,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Immutable record of admin actions on invoices and user roles"
      />
      <AuditLogTable
        logs={serialized}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        actionFilter={action}
      />
    </div>
  );
}
