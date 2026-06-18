import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, CheckCircle2, AlertCircle, Link as LinkIcon } from "lucide-react";

export default async function XeroSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const xeroToken = await db.xeroToken.findUnique({
    where: { id: "singleton" },
  });

  const isConnected = !!xeroToken;
  const lastSync = xeroToken?.updatedAt;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Xero Integration"
        subtitle="Manage direct connection between this portal and your Xero organization"
      />

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Xero connection failed: <strong>{decodeURIComponent(error)}</strong></span>
        </div>
      )}

      <div className="grid gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Direct API connection for synchronous invoice syncing</CardDescription>
              </div>
              {isConnected ? (
                <Badge variant="default" className="bg-success hover:bg-success/90 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isConnected ? (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md bg-accent/30">
                  <div>
                    <p className="text-muted-foreground">Organization ID (Tenant)</p>
                    <p className="font-mono font-bold truncate">{xeroToken.tenantId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Token Refresh</p>
                    <p className="font-bold">{lastSync ? new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Europe/Paris'
                    }).format(new Date(lastSync)) : 'Never'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <a href="/api/auth/xero/connect">
                    <Button variant="outline" className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Reconnect Xero
                    </Button>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Reconnect if you notice sync errors or want to change organizations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-secondary-text max-w-2xl">
                  Connect your Xero account to enable automatic creation of Draft Bills 
                  whenever a worker submits an invoice. This replaces the old n8n-based 
                  webhook integration.
                </p>
                <a href="/api/auth/xero/connect">
                  <Button className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Connect Xero Account
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>• Ensure your Xero user has permissions to manage Contacts and Bills.</p>
            <p>• Redirect URI must match: <code>{process.env.NEXT_PUBLIC_APP_URL}/api/auth/xero/callback</code></p>
            <p>• Required scopes: <code>openid</code>, <code>profile</code>, <code>email</code>, <code>offline_access</code>, <code>accounting.contacts</code>, <code>accounting.invoices</code>, <code>accounting.settings</code></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
