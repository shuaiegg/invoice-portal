"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Printer, Edit, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InvoiceDetailProps {
  invoice: any;
  isAdmin?: boolean;
}

export function InvoiceDetail({ invoice, isAdmin }: InvoiceDetailProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { worker } = invoice;

  const handlePrint = () => {
    window.print();
  };

  const handleRevoke = async () => {
    if (!window.confirm("Revoke this invoice? This action cannot be undone.")) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/revoke`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revoke invoice");
      }

      toast.success("Invoice revoked");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Your Company Name";
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "123 Company St";
  const companyCity = process.env.NEXT_PUBLIC_COMPANY_CITY || "Business City";
  const companyCountry = process.env.NEXT_PUBLIC_COMPANY_COUNTRY || "Country";
  const companyVat = process.env.NEXT_PUBLIC_COMPANY_VAT || "FR 99 999 999 999";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Action Bar - Hidden during print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "SUBMITTED" && !isAdmin && (
            <Link href={`/invoice/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          {invoice.status === "SUBMITTED" && !isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevoke}
              disabled={busy}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {busy ? "Revoking..." : "Revoke"}
            </Button>
          )}
          <Button onClick={handlePrint} size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print / Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Content */}
      <Card className="shadow-lg print:shadow-none print:border-none">
        <CardContent className="p-8 sm:p-12 space-y-12">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-8">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-primary">INVOICE</h1>
              <p className="text-lg font-medium text-muted-foreground">{invoice.invoiceNumber}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="font-bold text-xl">{companyName}</div>
              <p className="text-muted-foreground">{companyAddress}</p>
              <p className="text-muted-foreground">{companyCity}, {companyCountry}</p>
              <p className="text-muted-foreground">VAT: {companyVat}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-secondary-text">From</div>
              <div className="space-y-1">
                <div className="font-bold text-lg">{worker.name}</div>
                <p className="text-secondary-text">{worker.address}</p>
                <p className="text-secondary-text">{worker.city}, {worker.country}</p>
                {worker.vatNumber && <p className="text-secondary-text">VAT: {worker.vatNumber}</p>}
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-secondary-text">Invoice Details</div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-secondary-text">Invoice Date:</div>
                <div className="font-medium text-right">{formatDate(invoice.invoiceDate)}</div>
                <div className="text-secondary-text">Due Date:</div>
                <div className="font-medium text-right">{formatDate(invoice.dueDate)}</div>
                <div className="text-secondary-text">Billing Period:</div>
                <div className="font-medium text-right">{invoice.period}</div>
                {invoice.serviceDate && (
                  <>
                    <div className="text-secondary-text">Service Date:</div>
                    <div className="font-medium text-right">{formatDate(invoice.serviceDate)}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-sm font-bold uppercase tracking-wider text-secondary-text">
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">Qty</th>
                  <th className="py-3 px-2 text-right">Rate</th>
                  <th className="py-3 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-2 align-top max-w-md">
                    <div className="font-medium">{invoice.description}</div>
                  </td>
                  <td className="py-4 px-2 text-right align-top">{invoice.quantity}</td>
                  <td className="py-4 px-2 text-right align-top">{formatCurrency(invoice.rate)}</td>
                  <td className="py-4 px-2 text-right align-top font-bold">{formatCurrency(invoice.subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-text">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.vatRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-text">VAT ({invoice.vatRate}%)</span>
                  <span>{formatCurrency(invoice.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-3 text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="border-t pt-8 space-y-4">
            <div className="text-sm font-bold uppercase tracking-wider text-secondary-text">Payment Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-secondary-text">Method:</span>
                  <span className="font-medium">{worker.paymentMethod}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-secondary-text">Account / IBAN:</span>
                  <span className="font-medium">{worker.paymentAccount}</span>
                </div>
              </div>
              {worker.paymentNotes && (
                <div className="space-y-1">
                  <div className="text-secondary-text">Notes:</div>
                  <div className="italic text-secondary-text">{worker.paymentNotes}</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>
    </div>
  );
}
