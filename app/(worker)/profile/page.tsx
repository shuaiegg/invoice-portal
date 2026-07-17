import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/worker/profile-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;

  const worker = await db.worker.findUnique({
    where: { userId },
    include: {
      paymentAccounts: {
        orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  // No auto-create fallback: a Worker row only exists here if sign-up already claimed a
  // pre-provisioned one for this email — see app/api/profile/route.ts for the matching fix and
  // openspec/changes/td-sync-worker-onboarding for why (this page used to duplicate the same
  // auto-vivify gap independently of the API route, since it queries the DB directly).
  if (!worker) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader title="My Profile" />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="mb-2 text-lg font-semibold">Account not recognized</h2>
          <p>Your account isn&apos;t linked to a worker profile. Contact your administrator to get set up.</p>
        </div>
      </div>
    );
  }

  const hasLegacyPaymentData = [
    worker.paymentMethod,
    worker.paymentAccount,
    worker.bankName,
    worker.swiftCode,
    worker.postCode,
    worker.secondaryPayment,
    worker.paypalEmail,
    worker.cryptoCoin,
    worker.cryptoNetwork,
    worker.cryptoWallet,
  ].some(Boolean) && worker.paymentAccounts.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader 
        title="My Profile" 
        subtitle="Manage your personal, address, tax, and payment information"
      />
      <ProfileForm
        initialData={worker}
        paymentAccounts={worker.paymentAccounts}
        hasLegacyPaymentData={hasLegacyPaymentData}
      />
    </div>
  );
}
