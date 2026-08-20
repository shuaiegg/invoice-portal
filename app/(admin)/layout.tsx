import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Users, FileText, Settings, LayoutDashboard, ShieldCheck, Zap, ClipboardList, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";

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

  // Role comes from the session (cookie-cached, no DB hit). Admin API routes
  // stay authoritative via requireAdmin()'s DB check.
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const workerProfile = await db.worker.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

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
                  href="/admin/automation"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Automation
                </Link>
                <Link
                  href="/admin/audit"
                  className="text-foreground hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Audit Log
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

      {workerProfile && (
        <Link
          href="/dashboard"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          <ReceiptText className="h-4 w-4" />
          My Invoices
        </Link>
      )}
    </div>
  );
}
