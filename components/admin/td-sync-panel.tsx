"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatParisDateTime } from "@/lib/date-format";
import { ACTIVE_CURRENCIES } from "@/lib/currencies";

type Run = { id: string; runAt: string; status: string; invoicesCreated: number; skippedExisting: number; matchFailed: number; inactiveSkipped: number; ignoredSkipped: number; totalAmount: number; triggeredByName: string };
type FailureReason = "UNMATCHED" | "NEEDS_SETUP" | "MISSING_RATE";
type Failure = { id: string; tdName: string; tdEmail: string; reason: FailureReason; workerId: string | null; quantity: number | null; billingMonth: string | null };
type Worker = { id: string; name: string };

const REASON_LABEL: Record<FailureReason, string> = {
  UNMATCHED: "No Portal account",
  NEEDS_SETUP: "Never configured",
  MISSING_RATE: "Missing rate/currency",
};

type ProvisionForm = {
  name: string;
  hourlyRate: string;
  currency: string;
  paymentType: "TD_PLUS" | "MANUAL";
  accountType: "" | "WISE" | "PAYPAL";
  accountEmail: string;
};

function emptyForm(name: string): ProvisionForm {
  return { name, hourlyRate: "", currency: "", paymentType: "TD_PLUS", accountType: "", accountEmail: "" };
}

export function TdSyncPanel({ runs, failures, workers }: { runs: Run[]; failures: Failure[]; workers: Worker[] }) {
  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset - 1, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return { value, label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
  });
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [forms, setForms] = useState<Record<string, ProvisionForm>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  async function pollForResult(previousRunId: string | undefined, attempts = 0): Promise<void> {
    const response = await fetch("/api/admin/td-sync/status", { cache: "no-store" });
    const result = await response.json();
    const completed = result.lastRun && result.lastRun.id !== previousRunId && result.lastRun.status !== "RUNNING";
    if (completed) {
      setPending(false);
      if (result.lastRun.status === "FAILED") toast.error("Time Doctor sync failed");
      else toast.success(`${result.lastRun.invoicesCreated} created · ${result.lastRun.skippedExisting} already existed`);
      router.refresh();
      return;
    }
    if (attempts >= 149) {
      setPending(false);
      toast.error("Sync is still running. Check the run history shortly.");
      return;
    }
    window.setTimeout(() => void pollForResult(previousRunId, attempts + 1), 2_000);
  }

  async function run() {
    setPending(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const response = await fetch("/api/admin/td-sync/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    const result = await response.json();
    if (!response.ok) {
      setPending(false);
      toast.error(result.error || "Sync failed");
      return;
    }
    toast.success("Sync started");
    void pollForResult(runs[0]?.id);
  }

  async function resolve(id: string, body: Record<string, unknown>, successMessage: string) {
    const response = await fetch(`/api/admin/td-sync/failures/${id}/resolve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(result.error || "Resolution failed");
    setOpenId(null);
    toast.success(result.resolvedCount > 1 ? `${successMessage} · ${result.resolvedCount} months backfilled` : successMessage);
    router.refresh();
  }

  function updateForm(id: string, fallbackName: string, patch: Partial<ProvisionForm>) {
    setForms((current) => ({ ...current, [id]: { ...(current[id] ?? emptyForm(fallbackName)), ...patch } }));
  }

  function submitProvision(failure: Failure, action: "create" | "configure") {
    const form = forms[failure.id] ?? emptyForm(failure.tdName);
    const hourlyRate = Number(form.hourlyRate);
    if (!form.name.trim()) return toast.error("Name is required");
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return toast.error("Enter a valid hourly rate");
    if (!form.currency) return toast.error("Select a currency");
    resolve(failure.id, {
      action,
      name: form.name.trim(),
      hourlyRate,
      currency: form.currency,
      paymentType: form.paymentType,
      accountType: form.accountType || null,
      accountEmail: form.accountEmail.trim() || undefined,
    }, action === "create" ? "Worker created" : "Worker configured");
  }

  function ProvisionFields({ failure, showPaymentType }: { failure: Failure; showPaymentType: boolean }) {
    const form = forms[failure.id] ?? emptyForm(failure.tdName);
    return (
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor={`name-${failure.id}`}>Name</Label>
          <Input id={`name-${failure.id}`} value={form.name} onChange={(e) => updateForm(failure.id, failure.tdName, { name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`rate-${failure.id}`}>Hourly rate</Label>
            <Input id={`rate-${failure.id}`} type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => updateForm(failure.id, failure.tdName, { hourlyRate: e.target.value })} />
          </div>
          <div className="grid gap-2 min-w-0">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(value) => updateForm(failure.id, failure.tdName, { currency: value })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select currency" /></SelectTrigger>
              <SelectContent>{ACTIVE_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {showPaymentType ? (
          <div className="grid gap-2 min-w-0">
            <Label>Payment type</Label>
            <Select value={form.paymentType} onValueChange={(value) => updateForm(failure.id, failure.tdName, { paymentType: value as ProvisionForm["paymentType"] })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TD_PLUS">TD Plus</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.paymentType === "TD_PLUS"
                ? "Draft invoice generated from TD hours each month — worker reviews and submits."
                : "Worker types every invoice line item themselves, no TD hours involved."}
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2 min-w-0">
            <Label>Channel</Label>
            <Select value={form.accountType || "MANUAL"} onValueChange={(value) => updateForm(failure.id, failure.tdName, { accountType: value === "MANUAL" ? "" : (value as ProvisionForm["accountType"]) })}>
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
              <Label htmlFor={`account-email-${failure.id}`}>Account email</Label>
              <Input id={`account-email-${failure.id}`} className="w-full" value={form.accountEmail} onChange={(e) => updateForm(failure.id, failure.tdName, { accountEmail: e.target.value })} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const last = runs[0];
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Doctor sync</CardTitle>
          <CardDescription>{last ? `${last.invoicesCreated} invoices generated · ${last.skippedExisting} already existed · ${last.matchFailed} unmatched · ${last.inactiveSkipped} inactive skipped · ${last.ignoredSkipped} ignored · ${last.triggeredByName}` : "No sync runs yet"}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={pending}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={run} disabled={pending}>{pending ? "Running sync…" : "Run Sync Now"}</Button>
        </CardContent>
      </Card>

      {failures.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Match failures</CardTitle>
            <CardDescription>&quot;Ignore&quot; is permanent — use it for TD accounts that should never generate an invoice (e.g. the company owner).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {failures.map((failure) => (
              <div key={failure.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-64">
                  <div className="text-sm font-medium">{failure.tdName} · {failure.tdEmail}</div>
                  <div className="text-xs text-muted-foreground">{REASON_LABEL[failure.reason]}{failure.billingMonth ? ` · ${failure.billingMonth}` : ""}{failure.quantity !== null ? ` · ${failure.quantity.toFixed(1)}h` : ""}</div>
                </div>

                {failure.reason === "UNMATCHED" ? (
                  <>
                    <Select onValueChange={(value) => setLinks((current) => ({ ...current, [failure.id]: value }))}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="Select worker" /></SelectTrigger>
                      <SelectContent>{workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" disabled={!links[failure.id]} onClick={() => resolve(failure.id, { action: "link", workerId: links[failure.id] }, "Linked")}>Link</Button>
                  </>
                ) : null}

                <Dialog open={openId === failure.id} onOpenChange={(open) => setOpenId(open ? failure.id : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant={failure.reason === "UNMATCHED" ? "outline" : "default"}>
                      {failure.reason === "UNMATCHED" ? "Create new worker" : failure.reason === "NEEDS_SETUP" ? "Configure" : "Set rate"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{failure.reason === "UNMATCHED" ? "Create worker" : failure.reason === "NEEDS_SETUP" ? "Configure worker" : "Set hourly rate"}</DialogTitle>
                      <DialogDescription>
                        {failure.reason === "MISSING_RATE"
                          ? "This worker is already set up — just fill in the missing rate and currency."
                          : failure.reason === "UNMATCHED"
                          ? "Tracked in Time Doctor with no Portal account yet. Sets them up as TD Plus and immediately backfills any unresolved months, including this one."
                          : "Sets this worker's payment configuration and immediately backfills any unresolved months for them, including this one."}
                      </DialogDescription>
                    </DialogHeader>
                    <ProvisionFields failure={failure} showPaymentType={failure.reason === "NEEDS_SETUP"} />
                    <DialogFooter>
                      <Button onClick={() => submitProvision(failure, failure.reason === "UNMATCHED" ? "create" : "configure")}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button size="sm" variant="outline" onClick={() => resolve(failure.id, { action: "dismiss" }, "Resolved")}>Dismiss</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(failure.id, { action: "ignore" }, "Ignored — won't be flagged again in future syncs")}>Ignore permanently</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Last 12 runs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead><TableHead>Status</TableHead><TableHead>Invoices</TableHead><TableHead>Already existed</TableHead><TableHead>Unmatched</TableHead><TableHead>Inactive</TableHead><TableHead>Ignored</TableHead><TableHead>Triggered by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{formatParisDateTime(run.runAt)}</TableCell>
                  <TableCell>{run.status}</TableCell>
                  <TableCell>{run.invoicesCreated}</TableCell>
                  <TableCell>{run.skippedExisting}</TableCell>
                  <TableCell>{run.matchFailed}</TableCell>
                  <TableCell>{run.inactiveSkipped}</TableCell>
                  <TableCell>{run.ignoredSkipped}</TableCell>
                  <TableCell>{run.triggeredByName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
