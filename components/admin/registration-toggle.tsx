"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function RegistrationToggle({
  initialRegistrationOpen,
  pendingCount,
}: {
  initialRegistrationOpen: boolean;
  pendingCount: number;
}) {
  const [registrationOpen, setRegistrationOpen] = useState(initialRegistrationOpen);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    setPending(true);
    const response = await fetch("/api/admin/settings/registration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationOpen: next }),
    });
    setPending(false);
    if (!response.ok) return toast.error("Failed to update registration setting");
    setRegistrationOpen(next);
    toast.success(next ? "Self-service registration is open" : "Self-service registration is closed");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Registration</CardTitle>
        <CardDescription>Controls whether /register accepts new accounts for unmatched emails.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="registration-open">{registrationOpen ? "Open" : "Closed"}</Label>
            <p className="text-sm text-secondary-text">
              {registrationOpen
                ? "Anyone can create an account, but only an email matching a pending worker gets a working profile."
                : "Only emails matching a pending worker can sign up. Claim links (Add worker) always work regardless of this setting."}
            </p>
          </div>
          <Switch id="registration-open" checked={registrationOpen} disabled={pending} onCheckedChange={toggle} />
        </div>
        <div className="text-sm">
          <span className={pendingCount > 0 ? "font-semibold text-warning" : "font-semibold text-success"}>
            {pendingCount}
          </span>{" "}
          <span className="text-secondary-text">worker{pendingCount === 1 ? "" : "s"} still pending registration</span>
          {registrationOpen && pendingCount > 0 ? (
            <p className="mt-1 text-xs text-secondary-text">Wait for this to reach 0 before closing registration, or those workers will be locked out.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
