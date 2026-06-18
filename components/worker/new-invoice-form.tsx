"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

  const defaultVatRate = worker.vatRate > 0 ? worker.vatRate : 20;
  const [applyVat, setApplyVat] = useState(
    initialData ? (initialData.vatRate ?? 0) > 0 : worker.vatRate > 0
  );

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

  const [vatInclusive, setVatInclusive] = useState<boolean>(
    initialData ? (initialData.vatInclusive ?? false) : false
  );

  const [formData, setFormData] = useState({
    description: initialData?.description || "",
    period: initialData?.period || "",
    serviceDate: initialData?.serviceDate ? formatDateForInput(initialData.serviceDate) : "",
    // Empty string on server; set to today (Paris) after mount to avoid hydration mismatch
    invoiceDate: initialData?.invoiceDate ? formatDateForInput(initialData.invoiceDate) : "",
    quantity: initialData?.quantity || 1,
    rate: initialData?.rate || 0,
    vatRate: (initialData?.vatRate ?? 0) > 0 ? initialData.vatRate : defaultVatRate,
    currency: initialData?.currency || "USD",
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
    const effectiveVatRate = applyVat ? formData.vatRate : 0;
    let subtotal: number, vatAmount: number, totalAmount: number;
    if (applyVat && vatInclusive) {
      // Inclusive: user enters gross amount, extract VAT from it
      totalAmount = formData.quantity * formData.rate;
      subtotal = totalAmount / (1 + effectiveVatRate / 100);
      vatAmount = totalAmount - subtotal;
    } else {
      // Exclusive: VAT added on top of subtotal
      subtotal = formData.quantity * formData.rate;
      vatAmount = subtotal * (effectiveVatRate / 100);
      totalAmount = subtotal + vatAmount;
    }
    setAmounts({ subtotal, vatAmount, totalAmount });
  }, [formData.quantity, formData.rate, formData.vatRate, applyVat, vatInclusive]);

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
        body: JSON.stringify({
          ...formData,
          vatRate: applyVat ? formData.vatRate : 0,
          vatInclusive: applyVat ? vatInclusive : false,
        }),
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
      currency: formData.currency || "USD",
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
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
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
                  <Label htmlFor="rate">
                    Rate
                    {applyVat && vatInclusive && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(VAT incl.)</span>
                    )}
                  </Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-accent/20">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="applyVat"
                    checked={applyVat}
                    onCheckedChange={(checked) => setApplyVat(!!checked)}
                  />
                  <label htmlFor="applyVat" className="text-sm font-medium cursor-pointer select-none">
                    Apply VAT
                  </label>
                </div>

                {applyVat && (
                  <div className="flex flex-wrap items-center gap-4 pl-6">
                    <div className="flex items-center gap-2">
                      <Input
                        id="vatRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.vatRate}
                        onChange={handleChange}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>

                    <div className="flex items-center rounded-md border bg-background overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setVatInclusive(false)}
                        className={`px-3 py-1.5 transition-colors ${
                          !vatInclusive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        Exclusive
                      </button>
                      <button
                        type="button"
                        onClick={() => setVatInclusive(true)}
                        className={`px-3 py-1.5 transition-colors ${
                          vatInclusive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        Inclusive
                      </button>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {vatInclusive
                        ? "VAT is included in the rate — total stays the same"
                        : "VAT is added on top of the rate"}
                    </span>
                  </div>
                )}
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

              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger id="currency" className="bg-accent/50">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(amounts.subtotal)}</span>
                </div>
                {applyVat && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      VAT {formData.vatRate}%
                      {vatInclusive && <span className="ml-1 text-xs">(incl.)</span>}
                    </span>
                    <span className="font-medium">{formatCurrency(amounts.vatAmount)}</span>
                  </div>
                )}
                {applyVat && vatInclusive && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Net (ex-VAT)</span>
                    <span>{formatCurrency(amounts.subtotal)}</span>
                  </div>
                )}
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
