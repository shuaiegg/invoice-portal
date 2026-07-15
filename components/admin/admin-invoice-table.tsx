"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { InvoiceStatus } from "@/lib/generated/client/client";
import { formatCurrencyTotals } from "@/lib/money";
import { PAYMENT_CHANNEL_LABELS } from "@/lib/payment-channel";

type BulkAction = "APPROVE" | "MARK_PAID";
type SelectionMode = "page" | "filter";

interface AdminInvoiceTableProps {
  invoices: AdminInvoice[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  period: string;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  xeroSynced: boolean;
  invoiceDate: string | Date;
  channel: keyof typeof PAYMENT_CHANNEL_LABELS;
  worker: { name: string; team: string | null };
}

type DryRun = {
  targeted: number;
  totalsByCurrency: Record<string, number>;
  paymentIncomplete: Array<{ workerId: string; name: string; channel: string; missing: string[] }>;
};

type BulkResult = {
  transitioned: number;
  skippedWrongStatus: number;
  xeroSynced: number;
  xeroFailed: number;
};

export function AdminInvoiceTable({ invoices, total, page, totalPages }: AdminInvoiceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("page");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const selectableInvoices = invoices.filter((invoice) => invoice.status === "SUBMITTED" || invoice.status === "APPROVED");
  const selectedInvoices = selectableInvoices.filter((invoice) => selectedIds.includes(invoice.id));
  const selectedStatuses = new Set(selectedInvoices.map((invoice) => invoice.status));
  const filterStatuses = new Set(searchParams.get("status")?.split(",") ?? []);

  function currentFilter() {
    const channel = searchParams.get("channel")?.toUpperCase();
    return {
      billingMonth: searchParams.get("month") || undefined,
      channel: channel === "WISE" || channel === "PAYPAL" || channel === "MANUAL" ? channel : undefined,
      status: searchParams.get("status")?.split(",").filter(Boolean),
      workerName: searchParams.get("workerName") || undefined,
      period: searchParams.get("period") || undefined,
      xero: searchParams.get("xero") === "failed" ? "failed" : undefined,
    };
  }

  function targetBody() {
    return selectionMode === "filter" ? { filter: currentFilter() } : { invoiceIds: selectedIds };
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  }

  function toggleSelectAll(checked: boolean) {
    setSelectionMode("page");
    setSelectedIds(checked ? selectableInvoices.map((invoice) => invoice.id) : []);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectionMode("page");
    setSelectedIds((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  async function prepareBulk(action: BulkAction) {
    setBulkLoading(true);
    try {
      const response = await fetch("/api/admin/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...targetBody(), action, dryRun: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Bulk pre-check failed");
      setPendingAction(action);
      setDryRun(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk pre-check failed");
    } finally {
      setBulkLoading(false);
    }
  }

  async function executeBulk(excludeIncomplete: boolean) {
    if (!pendingAction || !dryRun) return;
    setBulkLoading(true);
    try {
      const response = await fetch("/api/admin/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetBody(),
          action: pendingAction,
          excludeWorkerIds: excludeIncomplete ? dryRun.paymentIncomplete.map((worker) => worker.workerId) : [],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Bulk operation failed");
      setResult(payload);
      setPendingAction(null);
      setDryRun(null);
      setSelectedIds([]);
      setSelectionMode("page");
      toast.success(`${payload.transitioned} transitioned · ${payload.skippedWrongStatus} skipped · ${payload.xeroFailed} Xero failed`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk operation failed");
    } finally {
      setBulkLoading(false);
    }
  }

  async function retryXero() {
    setBulkLoading(true);
    try {
      const response = await fetch("/api/admin/invoices/retry-xero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchParams.get("xero") === "failed" ? { filter: currentFilter() } : targetBody()),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Xero retry failed");
      setResult(payload);
      toast.success(`${payload.xeroSynced} synced · ${payload.xeroFailed} still failed`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xero retry failed");
    } finally {
      setBulkLoading(false);
    }
  }

  function getXeroStatus(invoice: AdminInvoice) {
    if (invoice.status !== "PAID") return null;
    return invoice.xeroSynced
      ? <Badge variant="outline"><CheckCircle2 data-icon="inline-start" />Synced</Badge>
      : <Badge variant="outline"><AlertCircle data-icon="inline-start" />Sync Failed</Badge>;
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  }

  function formatDate(date: string | Date) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(date));
  }

  const hasSelection = selectionMode === "filter" || selectedIds.length > 0;
  const mayApprove = selectionMode === "filter"
    ? filterStatuses.size === 0 || filterStatuses.has("SUBMITTED")
    : selectedStatuses.has("SUBMITTED");
  const mayMarkPaid = selectionMode === "filter"
    ? filterStatuses.size === 0 || filterStatuses.has("APPROVED")
    : selectedStatuses.has("APPROVED");
  const exportHref = `/api/admin/invoices/export?${searchParams.toString()}`;
  const failedParams = new URLSearchParams(searchParams.toString());
  failedParams.set("xero", "failed");
  failedParams.delete("page");

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.length === selectableInvoices.length && selectedIds.length > 0 && total > invoices.length && selectionMode === "page" ? (
        <Alert>
          <AlertTitle>All {selectedIds.length} eligible invoices on this page are selected.</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="px-0" onClick={() => setSelectionMode("filter")}>Select all {total} matching filters</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {hasSelection ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted p-4">
          <p className="text-sm font-medium">{selectionMode === "filter" ? `All ${total} matching invoices selected` : `${selectedIds.length} invoices selected`}</p>
          <div className="flex flex-wrap gap-2">
            {mayApprove ? <Button size="sm" onClick={() => void prepareBulk("APPROVE")} disabled={bulkLoading}>Approve</Button> : null}
            {mayMarkPaid ? <Button size="sm" onClick={() => void prepareBulk("MARK_PAID")} disabled={bulkLoading}><CreditCard data-icon="inline-start" />Mark Paid</Button> : null}
            <Button size="sm" variant="outline" asChild><a href={exportHref} download><Download data-icon="inline-start" />Export CSV</a></Button>
          </div>
        </div>
      ) : null}

      {searchParams.get("xero") === "failed" ? (
        <Button className="self-start" variant="outline" onClick={() => { setSelectionMode("filter"); void retryXero(); }} disabled={bulkLoading}>
          Retry all matching Xero failures
        </Button>
      ) : null}

      {result ? (
        <Alert>
          <AlertTitle>Bulk operation result</AlertTitle>
          <AlertDescription>
            {result.transitioned} transitioned · {result.skippedWrongStatus} skipped · {result.xeroSynced} Xero synced · {result.xeroFailed} Xero failed
            {result.xeroFailed > 0 ? <> · <Link href={`?${failedParams.toString()}`}>View failures</Link></> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50">
              <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => toggleSelectAll(!!checked)} checked={selectedIds.length > 0 && selectedIds.length === selectableInvoices.length} /></TableHead>
              <TableHead>Invoice #</TableHead><TableHead>Worker</TableHead><TableHead>Channel</TableHead><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Xero Sync</TableHead><TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No invoices found matching your filters.</TableCell></TableRow> : invoices.map((invoice) => (
              <TableRow key={invoice.id} className="cursor-pointer" onClick={() => router.push(`/admin/invoices/${invoice.id}`)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  {invoice.status === "SUBMITTED" || invoice.status === "APPROVED" ? <Checkbox checked={selectedIds.includes(invoice.id)} onCheckedChange={(checked) => toggleSelect(invoice.id, !!checked)} /> : null}
                </TableCell>
                <TableCell className="font-bold">{invoice.invoiceNumber}</TableCell>
                <TableCell><div className="flex flex-col"><span className="font-medium">{invoice.worker.name}</span><span className="text-xs text-muted-foreground">{invoice.worker.team}</span></div></TableCell>
                <TableCell>{PAYMENT_CHANNEL_LABELS[invoice.channel]}</TableCell>
                <TableCell>{invoice.period}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount, invoice.currency)}</TableCell>
                <TableCell><StatusBadge status={invoice.status} /></TableCell>
                <TableCell>{getXeroStatus(invoice)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatDate(invoice.invoiceDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} invoices</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1}><ChevronLeft data-icon="inline-start" />Previous</Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>Next<ChevronRight data-icon="inline-end" /></Button>
          </div>
        </div>
      ) : null}

      <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) { setPendingAction(null); setDryRun(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction === "APPROVE" ? "Approve invoices" : "Mark invoices paid"}</DialogTitle>
            <DialogDescription>Review the server-resolved batch before applying changes.</DialogDescription>
          </DialogHeader>
          {dryRun ? (
            <div className="flex flex-col gap-3">
              <p><strong>{dryRun.targeted}</strong> invoices · {formatCurrencyTotals(dryRun.totalsByCurrency)}</p>
              {dryRun.paymentIncomplete.length ? (
                <Alert>
                  <AlertTitle>{dryRun.paymentIncomplete.length} workers have incomplete payment details</AlertTitle>
                  <AlertDescription>{dryRun.paymentIncomplete.map((worker) => `${worker.name} (${worker.missing.join(", ")})`).join(" · ")}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingAction(null); setDryRun(null); }}>Cancel</Button>
            {dryRun?.paymentIncomplete.length ? <Button onClick={() => void executeBulk(true)} disabled={bulkLoading}>Proceed excluding {dryRun.paymentIncomplete.length}</Button> : null}
            <Button onClick={() => void executeBulk(false)} disabled={bulkLoading}>Proceed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
