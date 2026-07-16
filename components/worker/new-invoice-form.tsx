"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

type InvoiceFormLine = {
  description: string;
  quantity: number;
  unitRate: number;
};

type InitialInvoiceData = {
  id: string;
  description?: string | null;
  period?: string | null;
  serviceDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  quantity?: number | null;
  rate?: number | null;
  vatRate?: number | null;
  vatInclusive?: boolean | null;
  currency?: string | null;
  lines?: Array<InvoiceFormLine & { id?: string; rate?: number | null }>;
};

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
  initialData?: InitialInvoiceData;
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

  // VAT-inclusive is the company default: rates are gross, VAT is carved out
  const [vatInclusive, setVatInclusive] = useState<boolean>(
    initialData ? (initialData.vatInclusive ?? false) : true
  );

  const initialLines: InvoiceFormLine[] =
    initialData?.lines?.length
      ? initialData.lines.map((line) => ({
          description: line.description || "",
          quantity: line.quantity || 1,
          unitRate: line.unitRate ?? line.rate ?? 0,
        }))
      : [
          {
            description: initialData?.description || "",
            quantity: initialData?.quantity || 1,
            unitRate: initialData?.rate || 0,
          },
        ];

  const [lines, setLines] = useState<InvoiceFormLine[]>(initialLines);
  const initialVatRate = initialData?.vatRate && initialData.vatRate > 0 ? initialData.vatRate : defaultVatRate;

  const [formData, setFormData] = useState({
    period: initialData?.period || "",
    serviceDate: initialData?.serviceDate ? formatDateForInput(initialData.serviceDate) : "",
    invoiceDate: initialData?.invoiceDate ? formatDateForInput(initialData.invoiceDate) : getTodayInParis(),
    vatRate: initialVatRate,
    currency: initialData?.currency || "USD",
  });

  const amounts = useMemo(() => {
    const effectiveVatRate = applyVat ? formData.vatRate : 0;
    const lineSubtotal = lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.unitRate || 0), 0);
    let subtotal: number, vatAmount: number, totalAmount: number;
    if (applyVat && vatInclusive) {
      // Inclusive: user enters gross amount, extract VAT from it
      totalAmount = lineSubtotal;
      subtotal = totalAmount / (1 + effectiveVatRate / 100);
      vatAmount = totalAmount - subtotal;
    } else {
      // Exclusive: VAT added on top of subtotal
      subtotal = lineSubtotal;
      vatAmount = subtotal * (effectiveVatRate / 100);
      totalAmount = subtotal + vatAmount;
    }
    return { subtotal, vatAmount, totalAmount };
  }, [lines, formData.vatRate, applyVat, vatInclusive]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === "vatRate" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleLineChange = (index: number, field: keyof InvoiceFormLine, value: string) => {
    setLines((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              [field]: field === "description" ? value : parseFloat(value) || 0,
            }
          : line
      )
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitRate: 0 }]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, lineIndex) => lineIndex !== index) : prev));
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
          lines,
          vatRate: applyVat ? formData.vatRate : 0,
          vatInclusive: applyVat ? vatInclusive : false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit invoice");
      }

      const result = await response.json() as { invoiceId: string };
      toast.success(initialData ? "Invoice updated" : "Invoice submitted");
      window.location.href = `/invoice/${initialData ? initialData.id : result.invoiceId}`;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit invoice");
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
              <CardDescription>Billing period and service dates</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
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
                  <Label htmlFor="serviceDate">Service Date</Label>
                  <Input
                    id="serviceDate"
                    type="date"
                    value={formData.serviceDate}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    When the work was performed — this decides which billing month the invoice belongs to.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Services, additional compensation, and deductions</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                {/* Column headers — shown once above the first row */}
                <div className="hidden md:grid md:grid-cols-[2fr_80px_110px_110px_40px] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>
                    Rate
                    {applyVat && vatInclusive && (
                      <span className="ml-1 normal-case font-normal">(VAT incl.)</span>
                    )}
                  </span>
                  <span>Amount</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {lines.map((line, index) => {
                    const amount = (line.quantity || 0) * (line.unitRate || 0);

                    return (
                      <div key={index} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[2fr_80px_110px_110px_40px] md:items-center">
                        {/* Mobile labels only */}
                        <div className="grid gap-1">
                          <Label htmlFor={`line-description-${index}`} className="md:hidden text-xs text-muted-foreground">Description</Label>
                          <Input
                            id={`line-description-${index}`}
                            value={line.description}
                            onChange={(e) => handleLineChange(index, "description", e.target.value)}
                            required
                            maxLength={500}
                            placeholder="e.g. Software development services"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor={`line-quantity-${index}`} className="md:hidden text-xs text-muted-foreground">Qty</Label>
                          <Input
                            id={`line-quantity-${index}`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor={`line-rate-${index}`} className="md:hidden text-xs text-muted-foreground">Rate</Label>
                          <Input
                            id={`line-rate-${index}`}
                            type="number"
                            step="0.01"
                            value={line.unitRate}
                            onChange={(e) => handleLineChange(index, "unitRate", e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="md:hidden text-xs text-muted-foreground">Amount</Label>
                          <div className={`h-10 rounded-md border bg-accent/30 px-3 py-2 text-right text-sm font-semibold ${amount < 0 ? "text-destructive" : ""}`}>
                            {formatCurrency(amount)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end text-sm font-semibold">
                  <span className="mr-3 text-muted-foreground">Line total</span>
                  <span>{formatCurrency(lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.unitRate || 0), 0))}</span>
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
                    <SelectItem value="COP">COP - Colombian Peso</SelectItem>
                    <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                    <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="PHP">PHP - Philippine Peso</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
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
