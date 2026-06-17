"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Download,
  CreditCard
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface AdminInvoiceTableProps {
  invoices: any[];
  total: number;
  page: number;
  totalPages: number;
}

export function AdminInvoiceTable({ 
  invoices, 
  total, 
  page, 
  totalPages 
}: AdminInvoiceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select invoices that are APPROVED and can be marked as paid
      const approvableIds = invoices
        .filter(inv => inv.status === "APPROVED")
        .map(inv => inv.id);
      setSelectedIds(approvableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedIds.length === 0) return;
    
    setBulkLoading(true);
    try {
      const response = await fetch("/api/admin/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: selectedIds,
          status: "PAID"
        }),
      });

      if (!response.ok) throw new Error("Bulk update failed");

      toast.success(`Successfully marked ${selectedIds.length} invoices as paid`);
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      toast.error("Failed to update invoices");
    } finally {
      setBulkLoading(false);
    }
  };

  const getXeroStatus = (invoice: any) => {
    if (invoice.xeroSynced) {
      return (
        <Badge variant="outline" className="text-success border-success/30 bg-success/5 gap-1.5 py-0.5">
          <CheckCircle2 className="h-3 w-3" /> Synced
        </Badge>
      );
    }
    
    if (mounted) {
      const createdAt = new Date(invoice.createdAt);
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (createdAt < thirtyMinAgo) {
        return (
          <Badge variant="outline" className="text-error border-error/30 bg-error/5 gap-1.5 py-0.5">
            <AlertCircle className="h-3 w-3" /> Sync Failed
          </Badge>
        );
      }
    }

    return (
      <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 gap-1.5 py-0.5">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-medium text-primary">
            {selectedIds.length} invoices selected
          </p>
          <Button size="sm" onClick={handleBulkMarkAsPaid} disabled={bulkLoading}>
            <CreditCard className="mr-2 h-4 w-4" />
            Mark as Paid
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50">
              <TableHead className="w-12">
                <Checkbox 
                  onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  checked={selectedIds.length > 0 && selectedIds.length === invoices.filter(i => i.status === "APPROVED").length}
                />
              </TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Xero Sync</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No invoices found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow 
                  key={invoice.id} 
                  className="cursor-pointer hover:bg-accent/30 transition-colors group"
                  onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {invoice.status === "APPROVED" && (
                      <Checkbox 
                        checked={selectedIds.includes(invoice.id)}
                        onCheckedChange={(checked) => toggleSelect(invoice.id, !!checked)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-bold">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-text">{invoice.worker.name}</span>
                      <span className="text-xs text-secondary-text">{invoice.worker.team}</span>
                    </div>
                  </TableCell>
                  <TableCell>{invoice.period}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>{getXeroStatus(invoice)}</TableCell>
                  <TableCell className="text-right text-secondary-text">
                    {formatDate(invoice.invoiceDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-secondary-text">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} invoices
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
