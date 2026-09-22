"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit2, Globe, Plus, Shield, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Masked shape produced by app/(admin)/admin/settings/page.tsx — secrets are
// never sent to the client, only hasSecret/hasInternalSecret flags.
interface WebhookConfigRow {
  key: string;
  environment: string;
  url: string;
  enabled: boolean;
  lastTriggeredAt: string | Date | null;
  updatedAt: string | Date;
  hasSecret: boolean;
  hasInternalSecret: boolean;
}

// The edit dialog adds secret fields the user may type in.
type EditingConfig = WebhookConfigRow & { secret?: string; internalSecret?: string };

interface WebhookSettingsProps {
  initialConfigs: WebhookConfigRow[];
}

export function WebhookSettings({ initialConfigs }: WebhookSettingsProps) {
  const router = useRouter();
  const [configs, setConfigs] = useState(initialConfigs);
  const [editingConfig, setWebhookToEdit] = useState<EditingConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEdit = (config: WebhookConfigRow) => {
    setWebhookToEdit({ ...config });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setWebhookToEdit({
      key: "",
      environment: "production",
      url: "",
      enabled: false,
      lastTriggeredAt: null,
      updatedAt: new Date().toISOString(),
      hasSecret: false,
      hasInternalSecret: false,
      secret: "",
      internalSecret: "",
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    const key = editingConfig.key.trim();
    const environment = editingConfig.environment.trim();
    if (isCreating && (!key || !environment)) {
      toast.error("Event key and environment are required");
      return;
    }
    if (isCreating && configs.some((c) => c.key === key && c.environment === environment)) {
      toast.error("A webhook with this event key and environment already exists");
      return;
    }
    setLoading(true);
    try {
      // Build payload: do not include secret/internalSecret keys when left blank
      const payload: Partial<EditingConfig> = { ...editingConfig, key, environment };
      if (payload.secret === "" || payload.secret === undefined) delete payload.secret;
      if (payload.internalSecret === "" || payload.internalSecret === undefined) delete payload.internalSecret;

      const response = await fetch(`/api/admin/settings/webhooks/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update config");

      toast.success(isCreating ? "Webhook created" : "Webhook configuration updated");
      setIsDialogOpen(false);
      router.refresh();
      // Update local state (optimistic or after refresh)
      const saved = { ...editingConfig, key, environment };
      setConfigs(
        configs.some((c) => c.key === key && c.environment === environment)
          ? configs.map((c) => (c.key === key && c.environment === environment ? saved : c))
          : [...configs, saved],
      );
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (config: WebhookConfigRow) => {
    const nextEnabled = !config.enabled;
    try {
      // When toggling we send only the minimal payload (no secrets)
      const payload = {
        key: config.key,
        environment: config.environment,
        url: config.url,
        enabled: nextEnabled,
      };

      const response = await fetch(`/api/admin/settings/webhooks/${config.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Webhook ${nextEnabled ? "enabled" : "disabled"}`);
      setConfigs(configs.map(c => 
        (c.key === config.key && c.environment === config.environment) 
        ? { ...c, enabled: nextEnabled } 
        : c
      ));
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50">
              <TableHead>Event Key</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Webhook URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Triggered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-secondary-text">
                  No webhook configurations found. Run the seed script to create defaults.
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={`${config.key}-${config.environment}`}>
                  <TableCell className="font-bold font-mono">{config.key}</TableCell>
                  <TableCell>
                    <Badge variant={config.environment === "production" ? "default" : "secondary"}>
                      {config.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-secondary-text">
                    {config.url}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => toggleEnabled(config)}
                      />
                      <span className="text-sm">{config.enabled ? "Live" : "Paused"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-secondary-text">
                    {config.lastTriggeredAt
                      ? new Date(config.lastTriggeredAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Add Webhook" : "Configure Webhook"}</DialogTitle>
            {!isCreating && (
              <DialogDescription>
                {editingConfig?.key} for {editingConfig?.environment}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {isCreating && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="key">Event Key</Label>
                  <Input
                    id="key"
                    value={editingConfig?.key || ""}
                    onChange={(e) => editingConfig && setWebhookToEdit({ ...editingConfig, key: e.target.value })}
                    placeholder="e.g. invoice.paid"
                    className="bg-accent/30 font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Input
                    id="environment"
                    value={editingConfig?.environment || ""}
                    onChange={(e) => editingConfig && setWebhookToEdit({ ...editingConfig, environment: e.target.value })}
                    placeholder="production"
                    className="bg-accent/30"
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="url">Target URL (n8n Webhook Trigger)</Label>
              <Input
                id="url"
                value={editingConfig?.url || ""}
                onChange={(e) => editingConfig && setWebhookToEdit({ ...editingConfig, url: e.target.value })}
                className="bg-accent/30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="secret">X-Webhook-Secret (Optional)</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-text" />
                <Input
                  id="secret"
                  type="password"
                  value={editingConfig?.secret || ""}
                  onChange={(e) => editingConfig && setWebhookToEdit({ ...editingConfig, secret: e.target.value })}
                  className="pl-9 bg-accent/30"
                  placeholder="Leave blank to keep current"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="internalSecret">Internal Secret (For Callbacks)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-text" />
                <Input
                  id="internalSecret"
                  value={editingConfig?.internalSecret || ""}
                  onChange={(e) => editingConfig && setWebhookToEdit({ ...editingConfig, internalSecret: e.target.value })}
                  className="pl-9 bg-accent/30"
                />
              </div>
              <p className="text-[10px] text-secondary-text">
                Required header <code>X-Internal-Secret</code> when n8n calls back to <code>/api/internal/sync-status</code>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
