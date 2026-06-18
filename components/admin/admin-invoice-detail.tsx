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
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  User,
  CreditCard,
  History,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AdminInvoiceDetailProps {
  invoice: any;
}

export function AdminInvoiceDetail({ invoice }: AdminInvoiceDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [loading, setLoading] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { worker } = invoice;

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

  const handleResync = async () => {
    setResyncing(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/resync`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to queue re-sync");
      }
      toast.success("Re-sync queued — n8n will process it shortly");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResyncing(false);
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
      currency: "EUR",
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
    
    if (mounted) {
      const createdAt = new Date(invoice.createdAt);
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (createdAt < thirtyMinAgo) {
        return {
          label: "Sync Failed",
          color: "text-error",
          icon: <AlertCircle className="h-5 w-5" />,
          description: "The n8n workflow failed to sync this invoice to Xero after multiple attempts.",
        };
      }
    }

    return {
      label: "Pending Sync",
      color: "text-warning",
      icon: <Clock className="h-5 w-5" />,
      description: "This invoice is currently in the sync queue.",
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
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Quantity</div>
                  <div className="font-semibold">{invoice.quantity}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Rate</div>
                  <div className="font-semibold">{formatCurrency(invoice.rate)}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">VAT Rate</div>
                  <div className="font-semibold">{invoice.vatRate}%</div>
                </div>
              </div>
              <div className="p-6 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">Description</div>
                <div className="text-text leading-relaxed">{invoice.description}</div>
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
                  <div className="font-medium">{worker.user.email}</div>
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
                    <SelectItem value="SUBMITTED" disabled={invoice.status !== "SUBMITTED"}>Submitted</SelectItem>
                    <SelectItem value="APPROVED" disabled={invoice.status !== "SUBMITTED"}>Approved</SelectItem>
                    <SelectItem value="PAID" disabled={invoice.status !== "APPROVED"}>Paid</SelectItem>
                    <SelectItem value="VOID">Void (Reject)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-secondary-text leading-tight pt-1">
                  Valid transitions: Submitted → Approved, Approved → Paid, Any → Void.
                </p>
              </div>

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
                {!invoice.xeroSynced && invoice.status !== "VOID" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleResync}
                    disabled={resyncing}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${resyncing ? "animate-spin" : ""}`} />
                    {resyncing ? "Queuing..." : "Re-sync to Xero"}
                  </Button>
                )}
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
    </div>
  );
}
