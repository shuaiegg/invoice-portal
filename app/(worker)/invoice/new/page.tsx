import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NewInvoiceForm } from "@/components/worker/new-invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import { isWorkerProfileComplete } from "@/lib/profile-utils";
import { InfoIcon } from "lucide-react";
import Link from "next/link";

export default async function NewInvoicePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
  });

  const isProfileComplete = isWorkerProfileComplete(worker);

  if (!isProfileComplete) {
    return (
      <div className="max-w-6xl mx-auto">
        <PageHeader title="New Invoice" />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-900">
          <div className="flex items-center gap-3 mb-2">
            <InfoIcon className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Profile Incomplete</h2>
          </div>
          <p className="mb-4">
            You must complete your profile (address and payment details) before you can submit invoices.
          </p>
          <Link 
            href="/profile" 
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Complete Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader 
        title="New Invoice" 
        subtitle="Submit a new invoice for services rendered"
      />
      <NewInvoiceForm worker={worker!} />
    </div>
  );
}
