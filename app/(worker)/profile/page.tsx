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

  let worker = await db.worker.findUnique({
    where: { userId },
  });

  if (!worker) {
    worker = await db.worker.create({
      data: {
        userId,
        name: session.user.name || "Worker",
      },
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader 
        title="My Profile" 
        subtitle="Manage your personal, address, tax, and payment information"
      />
      <ProfileForm initialData={worker} />
    </div>
  );
}
