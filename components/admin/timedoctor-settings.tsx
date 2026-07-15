"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatParisDateTime } from "@/lib/date-format";

export function TimeDoctorSettings({ initial }: { initial: { companyId: string; tokenExpiresAt: string | null; expiringSoon: boolean } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);

  async function connect() {
    setConnecting(true);
    const response = await fetch("/api/admin/settings/timedoctor/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    setConnecting(false);
    if (!response.ok) return toast.error(result.error || "Connection failed");
    setPassword("");
    toast.success("Connected to Time Doctor");
    router.refresh();
  }

  async function save() {
    setSaving(true);
    const response = await fetch("/api/admin/settings/timedoctor", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, apiToken }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return toast.error(result.error || "Connection failed");
    setApiToken("");
    toast.success("Connection tested and Time Doctor settings saved");
    router.refresh();
  }

  return <Card>
    <CardHeader><CardTitle>Time Doctor</CardTitle><CardDescription>Connect with the dedicated Time Doctor integration account. Its email and password are only used once to obtain a token — neither is stored.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-4">
      {initial ? (
        <p className="text-sm text-muted-foreground">
          Connected · Company {initial.companyId}
          {initial.tokenExpiresAt ? <> · Token expires {formatParisDateTime(initial.tokenExpiresAt)}{initial.expiringSoon ? " — renew within 14 days" : ""}</> : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not connected yet.</p>
      )}

      <div className="flex flex-col gap-2"><Label htmlFor="tdEmail">Time Doctor email</Label><Input id="tdEmail" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="tdPassword">Time Doctor password</Label><Input id="tdPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <Button onClick={connect} disabled={connecting || !email || !password}>{connecting ? "Connecting…" : initial ? "Reconnect" : "Connect"}</Button>

      <button type="button" className="text-xs text-muted-foreground underline text-left w-fit" onClick={() => setShowManual((current) => !current)}>
        {showManual ? "Hide manual token entry" : "Paste an existing token instead"}
      </button>
      {showManual ? (
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-2"><Label htmlFor="companyId">Company ID</Label><Input id="companyId" value={companyId} onChange={(event) => setCompanyId(event.target.value)} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="apiToken">API token</Label><Input id="apiToken" type="password" value={apiToken} onChange={(event) => setApiToken(event.target.value)} /></div>
          <Button variant="outline" onClick={save} disabled={saving}>{saving ? "Testing…" : "Test connection and save"}</Button>
        </div>
      ) : null}
    </CardContent>
  </Card>;
}
