"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Undo2,
  User,
  CreditCard,
  History,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { isAdminInvoiceTransitionAllowed } from "@/lib/invoice-status";

interface AdminInvoiceDetailProps {
  invoice: any;
}

export function AdminInvoiceDetail({ invoice }: AdminInvoiceDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { worker } = invoice;
  const lines = invoice.lines?.length
    ? invoice.lines
    : [
        {
          description: invoice.description || "Invoice services",
          quantity: invoice.quantity,
          unitRate: invoice.rate,
          amount: invoice.subtotal,
        },
      ];

  const handleSaveStatus = async () => {
    if (status === invoice.status) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }

      toast.success("Invoice status updated successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
      setStatus(invoice.status); // Reset on error
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT", note: requestNote }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to request changes");
      }

      toast.success("Invoice returned to worker — they've been notified");
      setRequestOpen(false);
      setRequestNote("");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to request changes");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: invoice.currency || "USD",
    }).format(amount);
  };

  const getXeroStatus = () => {
    if (invoice.xeroSynced) {
      return {
        label: "Synced",
        color: "text-success",
        icon: <CheckCircle2 className="h-5 w-5" />,
        description: `Synced to Xero on ${formatDate(invoice.xeroSyncedAt)}`,
        id: invoice.xeroInvoiceId,
      };
    }
    
    return {
      label: "Not Synced",
      color: "text-secondary-text",
      icon: <AlertCircle className="h-5 w-5" />,
      description: invoice.status === "VOID" 
        ? "Invoice voided — not synced to Xero."
        : "Direct sync not established (legacy invoice).",
    };
  };

  const xero = getXeroStatus();

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Link href="/admin/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-secondary-text">Current Status:</span>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Invoice Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-accent/10">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{invoice.invoiceNumber}</CardTitle>
                <CardDescription>Submitted on {formatDate(invoice.createdAt)}</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{formatCurrency(invoice.totalAmount)}</div>
                <div className="text-sm text-secondary-text">Total including VAT</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4 border-b divide-x">
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Period</div>
                  <div className="font-semibold">{invoice.period}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Lines</div>
                  <div className="font-semibold">{lines.length}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Subtotal</div>
                  <div className="font-semibold">{formatCurrency(invoice.subtotal)}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">VAT Rate</div>
                  <div className="font-semibold">{invoice.vatRate}%</div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary-text">Line Items</div>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-accent/50 text-xs uppercase tracking-wider text-secondary-text">
                      <tr>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line: any) => (
                        <tr key={line.id || line.description} className="border-t">
                          <td className="px-3 py-3 font-medium">{line.description}</td>
                          <td className="px-3 py-3 text-right">{line.quantity}</td>
                          <td className="px-3 py-3 text-right">{formatCurrency(line.unitRate)}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${line.amount < 0 ? "text-error" : ""}`}>
                            {formatCurrency(line.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Worker Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-secondary-text" />
                <CardTitle className="text-lg">Worker Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Name</div>
                  <div className="font-medium">{worker.name}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Email</div>
                  <div className="font-medium">{worker.user?.email || worker.timeDoctorEmail || "Pending registration"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Team</div>
                  <Badge variant="secondary">{worker.team || "No Team"}</Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Address</div>
                  <div className="font-medium leading-tight">
                    {worker.address}<br />
                    {worker.city}, {worker.country}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">VAT Number</div>
                  <div className="font-medium">{worker.vatNumber || "N/A"}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-accent/5 border-t py-3">
              <Link href={`/admin/workers/${worker.id}`} className="text-sm font-medium text-primary hover:underline">
                View worker history →
              </Link>
            </CardFooter>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-secondary-text" />
                <CardTitle className="text-lg">Payment Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Method</div>
                <div className="font-medium">{worker.paymentMethod}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Account / IBAN</div>
                <div className="font-medium font-mono">{worker.paymentAccount}</div>
              </div>
              {worker.paymentNotes && (
                <div className="md:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Notes</div>
                  <div className="text-sm italic mt-1 text-secondary-text">{worker.paymentNotes}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Status Management */}
          <Card className="sticky top-24 border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-primary">Manage Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Update status to:</label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger className="bg-accent/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT" disabled={!isAdminInvoiceTransitionAllowed(invoice.status, "DRAFT")}>Draft</SelectItem>
                    <SelectItem value="SUBMITTED" disabled={!isAdminInvoiceTransitionAllowed(invoice.status, "SUBMITTED")}>Submitted</SelectItem>
                    <SelectItem value="APPROVED" disabled={!isAdminInvoiceTransitionAllowed(invoice.status, "APPROVED")}>Approved</SelectItem>
                    <SelectItem value="PAID" disabled={!isAdminInvoiceTransitionAllowed(invoice.status, "PAID")}>Paid</SelectItem>
                    <SelectItem value="VOID" disabled={!isAdminInvoiceTransitionAllowed(invoice.status, "VOID")}>Void (Reject)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-secondary-text leading-tight pt-1">
                  Valid transitions: Draft → Submitted, Submitted → Approved or back to Draft (request changes), Approved → Paid, Any → Void.
                </p>
              </div>

              {invoice.status === "SUBMITTED" && (
                <Button variant="outline" className="w-full" onClick={() => setRequestOpen(true)} disabled={loading}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Request Changes
                </Button>
              )}

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-start gap-3">
                  <div className={xero.color}>{xero.icon}</div>
                  <div className="space-y-1 flex-1">
                    <div className={`text-sm font-bold ${xero.color}`}>{xero.label}</div>
                    <p className="text-xs text-secondary-text">{xero.description}</p>
                    {xero.id && (
                      <div className="text-[10px] font-mono bg-accent px-1.5 py-0.5 rounded mt-1 inline-block">
                        ID: {xero.id}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleSaveStatus}
                disabled={status === invoice.status || loading}
              >
                {loading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Status Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={requestOpen} onOpenChange={(open) => { if (!open) setRequestOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes from {worker.name}</DialogTitle>
            <DialogDescription>
              The invoice returns to Draft and the worker is notified. They edit it and resubmit for approval.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="What needs to change? e.g. June hours look too high — please check the week of 15/06."
            value={requestNote}
            onChange={(event) => setRequestNote(event.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleRequestChanges} disabled={loading || !requestNote.trim()}>
              {loading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Return to worker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
