import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Users, FileText, Settings, LayoutDashboard, ShieldCheck } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Smart role check: Skip DB role lookup if JWT already says ADMIN
  const sessionUserRole = (session.user as any).role;
  
  if (sessionUserRole !== "ADMIN") {
    // JWT says WORKER — could be stale (first-user case). Check DB.
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (dbUser?.role !== "ADMIN") {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-accent/30">
      <nav className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-primary">
                <ShieldCheck className="mr-2 h-6 w-6" />
                AdminPanel
              </div>
              <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/admin"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Overview
                </Link>
                <Link
                  href="/admin/workers"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Workers
                </Link>
                <Link
                  href="/admin/invoices"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Invoices
                </Link>
                <Link
                  href="/admin/settings"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
