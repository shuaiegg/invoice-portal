"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ACTIVE_CURRENCIES } from "@/lib/currencies";

type FormState = {
  name: string;
  timeDoctorEmail: string;
  hourlyRate: string;
  currency: string;
  accountType: "" | "WISE" | "PAYPAL";
  accountEmail: string;
};

const initialState: FormState = {
  name: "", timeDoctorEmail: "", hourlyRate: "", currency: "", accountType: "", accountEmail: "",
};

// Every worker created here is a Time Doctor employee — this exists so admin can onboard one or
// two new hires mid-month without waiting for (or redoing) a full CSV re-import. `paymentType`
// is always TD_PLUS: the next TD sync matches this worker by their Time Doctor email and
// generates their draft invoice from real TD hours, exactly like a CSV-imported worker. There's
// no Manual option here — that's a distinct, deliberate case handled from the worker's own
// detail page, not this quick-add flow (per user direction 2026-07-17: offering it here just
// invites finance confusion). No automated invite is sent — instead, a one-time claim link is
// generated (openspec/changes/close-worker-registration) for admin to copy and send however they
// normally reach the person (Slack, in person, etc.).
export function AddWorkerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function reset() {
    setForm(initialState);
    setClaimUrl(null);
    setCopied(false);
  }

  async function submit() {
    const hourlyRate = Number(form.hourlyRate);
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.timeDoctorEmail.trim()) return toast.error("Time Doctor email is required");
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return toast.error("Enter a valid hourly rate");
    if (!form.currency) return toast.error("Select a currency");

    setPending(true);
    const response = await fetch("/api/admin/workers/manual-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        timeDoctorEmail: form.timeDoctorEmail.trim(),
        hourlyRate,
        currency: form.currency,
        paymentType: "TD_PLUS",
        accountType: form.accountType || null,
        accountEmail: form.accountEmail.trim() || undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return toast.error(result.error || "Failed to create worker");

    setClaimUrl(`${window.location.origin}/claim/${result.claimToken}`);
    router.refresh();
  }

  async function copyLink() {
    if (!claimUrl) return;
    await navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="mr-2 h-4 w-4" />Add worker</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {claimUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>{form.name.trim()} created</DialogTitle>
              <DialogDescription>
                Send this link to them however you normally would (Slack, in person, etc.) — it lets them set their own password. It expires in 21 days and works even if registration is closed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              <Input readOnly value={claimUrl} className="w-full font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button type="button" size="icon" variant="outline" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add worker</DialogTitle>
              <DialogDescription>
                For a new hire this month, tracked in Time Doctor. Set their Time Doctor email so the next sync matches and generates their draft invoice automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="add-worker-name">Name</Label>
                <Input id="add-worker-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-worker-td-email">Time Doctor email</Label>
                <Input id="add-worker-td-email" type="email" className="w-full" value={form.timeDoctorEmail} onChange={(e) => update({ timeDoctorEmail: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-worker-rate">Hourly rate</Label>
                  <Input id="add-worker-rate" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => update({ hourlyRate: e.target.value })} />
                </div>
                <div className="grid gap-2 min-w-0">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(value) => update({ currency: value })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select currency" /></SelectTrigger>
                    <SelectContent>{ACTIVE_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2 min-w-0">
                  <Label>Channel</Label>
                  <Select value={form.accountType || "MANUAL"} onValueChange={(value) => update({ accountType: value === "MANUAL" ? "" : (value as FormState["accountType"]) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="WISE">Wise</SelectItem>
                      <SelectItem value="PAYPAL">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.accountType ? (
                  <div className="grid gap-2 min-w-0">
                    <Label htmlFor="add-worker-account-email">Account email</Label>
                    <Input id="add-worker-account-email" className="w-full" value={form.accountEmail} onChange={(e) => update({ accountEmail: e.target.value })} />
                  </div>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending}>{pending ? "Creating…" : "Create worker"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
