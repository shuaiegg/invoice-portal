"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatParisDateTime } from "@/lib/date-format";

type Run = { id: string; runAt: string; status: string; invoicesCreated: number; skippedExisting: number; matchFailed: number; inactiveSkipped: number; ignoredSkipped: number; totalAmount: number; triggeredByName: string };
type Failure = { id: string; tdName: string; tdEmail: string };
type Worker = { id: string; name: string };

export function TdSyncPanel({ runs, failures, workers }: { runs: Run[]; failures: Failure[]; workers: Worker[] }) {
  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset - 1, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return { value, label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
  });
  const router = useRouter(); const [pending, setPending] = useState(false); const [links, setLinks] = useState<Record<string, string>>({}); const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
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
  async function resolve(id: string, action: "link" | "dismiss" | "ignore") {
    const response = await fetch(`/api/admin/td-sync/failures/${id}/resolve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerId: links[id],
        dismiss: action === "dismiss",
        ignore: action === "ignore",
      }),
    });
    if (!response.ok) return toast.error("Resolution failed");
    toast.success(action === "ignore" ? "Ignored — won't be flagged again in future syncs" : "Resolved");
    router.refresh();
  }
  const last = runs[0];
  return <div className="flex flex-col gap-6"><Card><CardHeader><CardTitle>Time Doctor sync</CardTitle><CardDescription>{last ? `${last.invoicesCreated} invoices generated · ${last.skippedExisting} already existed · ${last.matchFailed} unmatched · ${last.inactiveSkipped} inactive skipped · ${last.ignoredSkipped} ignored · ${last.triggeredByName}` : "No sync runs yet"}</CardDescription></CardHeader><CardContent className="flex items-center gap-3"><Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={pending}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Button onClick={run} disabled={pending}>{pending ? "Running sync…" : "Run Sync Now"}</Button></CardContent></Card>
    {failures.length ? <Card><CardHeader><CardTitle>Match failures</CardTitle><CardDescription>&quot;Ignore&quot; is permanent — use it for TD accounts that should never generate an invoice (e.g. the company owner).</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{failures.map((failure) => <div key={failure.id} className="flex items-center gap-2"><span className="min-w-64 text-sm">{failure.tdName} · {failure.tdEmail}</span><Select onValueChange={(value) => setLinks((current) => ({ ...current, [failure.id]: value }))}><SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger><SelectContent>{workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent></Select><Button size="sm" disabled={!links[failure.id]} onClick={() => resolve(failure.id, "link")}>Link</Button><Button size="sm" variant="outline" onClick={() => resolve(failure.id, "dismiss")}>Dismiss</Button><Button size="sm" variant="outline" onClick={() => resolve(failure.id, "ignore")}>Ignore permanently</Button></div>)}</CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Last 12 runs</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Status</TableHead><TableHead>Invoices</TableHead><TableHead>Already existed</TableHead><TableHead>Unmatched</TableHead><TableHead>Inactive</TableHead><TableHead>Ignored</TableHead><TableHead>Triggered by</TableHead></TableRow></TableHeader><TableBody>{runs.map((run) => <TableRow key={run.id}><TableCell>{formatParisDateTime(run.runAt)}</TableCell><TableCell>{run.status}</TableCell><TableCell>{run.invoicesCreated}</TableCell><TableCell>{run.skippedExisting}</TableCell><TableCell>{run.matchFailed}</TableCell><TableCell>{run.inactiveSkipped}</TableCell><TableCell>{run.ignoredSkipped}</TableCell><TableCell>{run.triggeredByName}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
