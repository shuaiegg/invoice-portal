"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface InvoiceDashboardProps {
  initialInvoices: any[];
  totalInvoices: number;
  isProfileComplete: boolean;
}

export function InvoiceDashboard({ 
  initialInvoices, 
  totalInvoices, 
  isProfileComplete 
}: InvoiceDashboardProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;
  const totalPages = Math.ceil(totalInvoices / limit);

  const fetchPage = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/invoices?page=${page}`);
      const data = await response.json();
      setInvoices(data.invoices);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
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
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (!isProfileComplete) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <InfoIcon className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900">Complete your profile</AlertTitle>
        <AlertDescription className="text-amber-800">
          Please <Link href="/profile" className="font-bold underline">complete your profile</Link> with your address and payment details before you can submit invoices.
        </AlertDescription>
      </Alert>
    );
  }

  if (totalInvoices === 0) {
    return (
      <EmptyState 
        message="No invoices yet" 
        description="You haven't submitted any invoices. Click the 'New Invoice' button to get started."
        action={
          <Link href="/invoice/new">
            <Button>Submit First Invoice</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50">
              <TableHead className="w-[150px]">Invoice #</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow 
                key={invoice.id} 
                className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => router.push(`/invoice/${invoice.id}`)}
              >
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.period}</TableCell>
                <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDate(invoice.invoiceDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-secondary-text">
            Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalInvoices)} of {totalInvoices} invoices
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
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
