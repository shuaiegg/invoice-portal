import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRolePanel } from "@/components/admin/user-role-panel";

export default async function UserManagementPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [users, firstUser] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        worker: { select: { name: true } },
      },
    }),
    db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "ADMIN" | "WORKER",
    createdAt: u.createdAt.toISOString(),
    isInitial: u.id === firstUser?.id,
    isSelf: u.id === session.user.id,
    workerName: u.worker?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage admin access for registered users. The initial account is permanently protected."
      />
      <Card>
        <CardHeader>
          <CardTitle>Registered Users ({users.length})</CardTitle>
          <CardDescription>
            Promote workers to Admin to grant access to this panel. You cannot change your own role.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <UserRolePanel users={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
