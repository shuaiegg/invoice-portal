import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { WebhookSettings } from "@/components/admin/webhook-settings";

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const webhookConfigs = await db.webhookConfig.findMany({
    orderBy: [
      { key: "asc" },
      { environment: "asc" },
    ],
  });

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Admin Settings" 
        subtitle="Manage integration webhooks and system-wide configurations"
      />

      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-text">Integration Webhooks</h2>
        <p className="text-secondary-text max-w-3xl">
          Configure where Next.js sends events like <code>invoice.submitted</code>. 
          n8n workflows should be set to trigger on these URLs.
        </p>
        
        <WebhookSettings initialConfigs={webhookConfigs} />
      </div>
    </div>
  );
}
