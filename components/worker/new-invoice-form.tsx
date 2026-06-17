"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface NewInvoiceFormProps {
  worker: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    vatNumber: string | null;
    vatRate: number;
    paymentMethod: string | null;
    paymentAccount: string | null;
  };
  initialData?: any; // For edit case
}

export function NewInvoiceForm({ worker, initialData }: NewInvoiceFormProps) {
  const [loading, setLoading] = useState(false);

  // Default date in Europe/Paris
  const getTodayInParis = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now); // YYYY-MM-DD
  };

  const formatDateForInput = (value: string | Date) => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  };

  const [formData, setFormData] = useState({
    description: initialData?.description || "",
    period: initialData?.period || "",
    serviceDate: initialData?.serviceDate ? formatDateForInput(initialData.serviceDate) : "",
    // Empty string on server; set to today (Paris) after mount to avoid hydration mismatch
    invoiceDate: initialData?.invoiceDate ? formatDateForInput(initialData.invoiceDate) : "",
    quantity: initialData?.quantity || 1,
    rate: initialData?.rate || 0,
    vatRate: initialData?.vatRate ?? worker.vatRate,
    currency: initialData?.currency || "EUR",
  });

  useEffect(() => {
    if (!initialData?.invoiceDate) {
      setFormData(prev => ({ ...prev, invoiceDate: getTodayInParis() }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [amounts, setAmounts] = useState({
    subtotal: 0,
    vatAmount: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    const subtotal = formData.quantity * formData.rate;
    const vatAmount = subtotal * (formData.vatRate / 100);
    const totalAmount = subtotal + vatAmount;
    setAmounts({ subtotal, vatAmount, totalAmount });
  }, [formData.quantity, formData.rate, formData.vatRate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: ["quantity", "rate", "vatRate"].includes(id) ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = initialData ? `/api/invoices/${initialData.id}` : "/api/invoices";
      const method = initialData ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit invoice");
      }

      const result = await response.json();
      toast.success(initialData ? "Invoice updated" : "Invoice submitted");
      window.location.href = `/invoice/${initialData ? initialData.id : result.invoiceId}`;
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Description of services provided</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Software development services for June 2026"
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="period">Billing Period</Label>
                  <Input
                    id="period"
                    value={formData.period}
                    onChange={handleChange}
                    required
                    placeholder="e.g. June 2026"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="serviceDate">Service Date (Optional)</Label>
                  <Input
                    id="serviceDate"
                    type="date"
                    value={formData.serviceDate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quantities & Rates</CardTitle>
              <CardDescription>Calculate your invoice totals</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity (e.g. Days/Hours)</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rate">Rate (EUR)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.01"
                  value={formData.vatRate}
                  onChange={handleChange}
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(amounts.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({formData.vatRate}%)</span>
                  <span className="font-medium">{formatCurrency(amounts.vatAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(amounts.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {initialData ? "Update Invoice" : "Submit Invoice"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
