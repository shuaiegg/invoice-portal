import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Role enforcement: only ADMIN can access (admin) routes
  // Note: session.user.role comes from our Prisma User model
  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-blue-400">
                AdminPanel
              </div>
              <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/admin"
                  className="text-gray-300 hover:text-white inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Overview
                </Link>
                <Link
                  href="/admin/workers"
                  className="text-gray-300 hover:text-white inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Workers
                </Link>
                <Link
                  href="/admin/invoices"
                  className="text-gray-300 hover:text-white inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Invoices
                </Link>
                <Link
                  href="/admin/settings"
                  className="text-gray-300 hover:text-white inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <LogoutButton className="text-gray-300 hover:text-white text-sm font-medium" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
