"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatParisDateTime } from "@/lib/date-format";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type Conflict = {
  id: string;
  portalRate: number;
  importedRate: number;
  worker: { name: string; timeDoctorEmail: string | null };
};
type Batch = {
  id: string;
  filename: string;
  importedBy: string;
  importedAt: Date;
  createdCount: number;
  updatedCount: number;
  conflictCount: number;
};

type LastResult =
  | { type: "success"; createdCount: number; updatedCount: number; conflictCount: number; filename: string }
  | { type: "error"; message: string };

export function WorkerImportAdmin({ conflicts, batches }: { conflicts: Conflict[]; batches: Batch[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false); // mirrors `pending` synchronously — the `disabled` prop can lag a render behind a fast double-click, this can't
  const formRef = useRef<HTMLFormElement>(null);
  // Shown inline until the next import starts — a toast alone is easy to miss, and this is the
  // only durable on-screen confirmation of whether the last import actually succeeded.
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setLastResult(null);
    const formData = new FormData(event.currentTarget);
    const filename = (formData.get("file") as File | null)?.name ?? "file";
    try {
      const response = await fetch("/api/admin/workers/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error || "Import failed";
        setLastResult({ type: "error", message });
        toast.error(message);
        return;
      }
      setLastResult({ type: "success", filename, ...result });
      toast.success(`${result.createdCount} created · ${result.updatedCount} updated · ${result.conflictCount} conflicts`);
      formRef.current?.reset();
      router.refresh();
    } catch {
      const message = "Import failed — check your connection and try again";
      setLastResult({ type: "error", message });
      toast.error(message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function resolve(id: string, action: "keep_portal" | "use_imported") {
    const response = await fetch(`/api/admin/workers/import/conflicts/${id}/resolve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) return toast.error("Could not resolve conflict");
    toast.success("Conflict resolved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Doctor payroll import</CardTitle>
          <CardDescription>Upload the Payroll summary CSV. Rates and currencies come only from this export.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form ref={formRef} onSubmit={upload} className="flex items-center gap-3">
            <Input name="file" type="file" accept=".csv,text/csv" required disabled={pending} />
            <Button type="submit" disabled={pending}>
              {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : "Import CSV"}
            </Button>
          </form>
          {pending ? (
            <p className="text-sm text-muted-foreground">
              Importing — this can take a few minutes for large files. Please don&apos;t close this page or click Import again.
            </p>
          ) : null}
          {!pending && lastResult?.type === "success" ? (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{lastResult.filename}</strong> imported: {lastResult.createdCount} created · {lastResult.updatedCount} updated · {lastResult.conflictCount} conflicts flagged for review.
              </span>
            </div>
          ) : null}
          {!pending && lastResult?.type === "error" ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{lastResult.message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rate conflicts</CardTitle><CardDescription>Manual Portal overrides are never silently replaced.</CardDescription></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Portal</TableHead><TableHead>Imported</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{conflicts.map((conflict) => <TableRow key={conflict.id}>
              <TableCell>{conflict.worker.name}</TableCell><TableCell>{conflict.portalRate}</TableCell><TableCell>{conflict.importedRate}</TableCell>
              <TableCell className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolve(conflict.id, "keep_portal")}>Keep Portal value</Button><Button size="sm" onClick={() => resolve(conflict.id, "use_imported")}>Use imported value</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Import history</CardTitle><CardDescription>Last 12 Payroll summary imports.</CardDescription></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>File</TableHead><TableHead>Admin</TableHead><TableHead>Created</TableHead><TableHead>Updated</TableHead><TableHead>Conflicts</TableHead></TableRow></TableHeader>
          <TableBody>{batches.map((batch) => <TableRow key={batch.id}><TableCell>{formatParisDateTime(batch.importedAt)}</TableCell><TableCell>{batch.filename}</TableCell><TableCell>{batch.importedBy}</TableCell><TableCell>{batch.createdCount}</TableCell><TableCell>{batch.updatedCount}</TableCell><TableCell>{batch.conflictCount}</TableCell></TableRow>)}</TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
