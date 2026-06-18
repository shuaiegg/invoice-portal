"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Printer, Edit, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "ITACWT Limited";
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "2 Cruise Park Rise, Tyrrelstown";
  const companyCity = process.env.NEXT_PUBLIC_COMPANY_CITY || "Dublin 15";
  const companyCountry = process.env.NEXT_PUBLIC_COMPANY_COUNTRY || "Ireland";
  const companyVat = process.env.NEXT_PUBLIC_COMPANY_VAT || "IE3450340QH";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: invoice.currency || "USD",
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
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">BILLED TO</div>
                <div className="font-bold text-lg">{companyName}</div>
                <p className="text-sm text-secondary-text">VAT No. {companyVat}</p>
                <p className="text-sm text-secondary-text">{companyAddress}</p>
                <p className="text-sm text-secondary-text">{companyCity}, {companyCountry}</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-primary">INVOICE</h1>
              <div className="space-y-1">
                <p className="text-lg font-bold text-text">#{invoice.invoiceNumber}</p>
                <p className="text-sm text-secondary-text">Date: {formatDate(invoice.invoiceDate)}</p>
                <p className="text-sm text-secondary-text">Due Date: {formatDate(invoice.dueDate)}</p>
                <p className="text-sm text-secondary-text font-medium">Period: {invoice.period}</p>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-secondary-text">PAY TO</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <div className="font-bold text-lg text-text">{worker.name}</div>
                  <p className="text-secondary-text">
                    {worker.address}{worker.postCode ? `, ${worker.postCode}` : ""}
                  </p>
                  <p className="text-secondary-text">{worker.city}, {worker.country}</p>
                  {worker.vatNumber && <p className="text-secondary-text">VAT: {worker.vatNumber}</p>}
                </div>
                
                <div className="space-y-1 text-sm border-l pl-8 border-dashed">
                  {worker.bankName && (
                    <div className="flex justify-between">
                      <span className="text-secondary-text">Bank:</span>
                      <span className="font-medium text-text">{worker.bankName}</span>
                    </div>
                  )}
                  {worker.swiftCode && (
                    <div className="flex justify-between">
                      <span className="text-secondary-text">SWIFT:</span>
                      <span className="font-medium text-text">{worker.swiftCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-secondary-text">Account:</span>
                    <span className="font-medium text-text">{worker.paymentAccount}</span>
                  </div>
                  {worker.secondaryPayment && (
                    <div className="pt-2 mt-2 border-t border-dashed border-gray-100 italic text-secondary-text text-xs whitespace-pre-wrap">
                      {worker.secondaryPayment}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-sm font-bold uppercase tracking-wider text-secondary-text">
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">Rate</th>
                  <th className="py-3 px-2 text-right">Qty</th>
                  <th className="py-3 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-2 align-top max-w-md">
                    <div className="font-medium text-text">{invoice.description}</div>
                  </td>
                  <td className="py-4 px-2 text-right align-top">{formatCurrency(invoice.rate)}</td>
                  <td className="py-4 px-2 text-right align-top">{invoice.quantity}</td>
                  <td className="py-4 px-2 text-right align-top font-bold text-text">{formatCurrency(invoice.subtotal)}</td>
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
                <span className="text-text">Total</span>
                <span className="text-primary">{formatCurrency(invoice.totalAmount)}</span>
              </div>
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
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
}
