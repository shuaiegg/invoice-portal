import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, CreditCard, Clock } from "lucide-react";
import Link from "next/link";
import { WebhookSettings } from "@/components/admin/webhook-settings";

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const webhookConfigs = await db.webhookConfig.findMany({
    orderBy: { key: "asc" },
  });

  const maskedConfigs = webhookConfigs.map((config) => ({
    key: config.key,
    environment: config.environment,
    url: config.url.length > 6 ? `****${config.url.slice(-6)}` : "****",
    enabled: config.enabled,
    lastTriggeredAt: config.lastTriggeredAt,
    updatedAt: config.updatedAt,
    hasSecret: !!config.secret,
    hasInternalSecret: !!config.internalSecret,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Settings"
        subtitle="Manage integrations and system-wide configurations"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Xero Integration</CardTitle>
            </div>
            <CardDescription>
              Direct sync of invoices to Xero as Draft Bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-text mb-4">
              Manage your Xero connection, organization settings, and synchronization status.
            </p>
            <Link href="/admin/settings/xero">
              <Button variant="outline" className="w-full">
                Configure Xero
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card><CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle>Time Doctor</CardTitle></div><CardDescription>Configure the read-only monthly hours integration.</CardDescription></CardHeader><CardContent><Link href="/admin/settings/timedoctor"><Button variant="outline" className="w-full">Configure Time Doctor<ExternalLink className="ml-2 h-4 w-4" /></Button></Link></CardContent></Card>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">n8n Webhook Configuration</h2>
          <p className="text-sm text-secondary-text mt-1">
            Configure webhook endpoints for n8n event notifications (Slack, Xero fallback, etc.)
          </p>
        </div>
        <WebhookSettings initialConfigs={maskedConfigs} />
      </div>
    </div>
  );
}
