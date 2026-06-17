import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InvoiceDashboard } from "@/components/worker/invoice-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { isWorkerProfileComplete } from "@/lib/profile-utils";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // JWT is minted before the first-user-admin DB hook fires, so read role from DB
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role === "ADMIN") {
    redirect("/admin");
  }

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
  });

  const isProfileComplete = isWorkerProfileComplete(worker);

  const invoices = worker
    ? await db.invoice.findMany({
        where: { workerId: worker.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const totalInvoices = worker
    ? await db.invoice.count({
        where: { workerId: worker.id },
      })
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader 
        title="My Invoices" 
        subtitle="Manage and track your submitted invoices"
        action={
          <Link href="/invoice/new">
            <Button disabled={!isProfileComplete}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        }
      />
      <InvoiceDashboard 
        initialInvoices={invoices} 
        totalInvoices={totalInvoices}
        isProfileComplete={isProfileComplete}
      />
    </div>
  );
}
