import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { User, PlusCircle, LayoutDashboard, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-accent/30">
      <nav className="bg-white border-b border-border sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-primary">
                InvoicePortal
              </div>
              <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="text-text hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/invoice/new"
                  className="text-text hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Invoice
                </Link>
                <Link
                  href="/profile"
                  className="text-text hover:text-primary inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 print:max-w-none print:p-0">
        {children}
      </main>

      {isAdmin && (
        <Link
          href="/admin"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          <ShieldCheck className="h-4 w-4" />
          Admin Panel
        </Link>
      )}
    </div>
  );
}
