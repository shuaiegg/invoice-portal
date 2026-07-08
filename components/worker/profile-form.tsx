"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Wise",          label: "Wise" },
  { value: "PayPal",        label: "PayPal" },
  { value: "Crypto",        label: "Crypto" },
  { value: "Revolut",       label: "Revolut" },
  { value: "Other",         label: "Other (see Payment Notes)" },
] as const;

interface ProfileFormProps {
  initialData: {
    name: string;
    team: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    vatNumber: string | null;
    vatRate: number;
    paymentMethod: string | null;
    paymentAccount: string | null;
    paymentNotes: string | null;
    bankName: string | null;
    swiftCode: string | null;
    postCode: string | null;
    secondaryPayment: string | null;
    timeDoctorEmail: string | null;
    cryptoCoin: string | null;
    cryptoNetwork: string | null;
    cryptoWallet: string | null;
    paypalEmail: string | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState(initialData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === "vatRate" ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <Card>
        <CardHeader>
          <CardTitle>Personal Info</CardTitle>
          <CardDescription>Your basic identification details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="As it appears on your invoices"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team">Team / Department</Label>
            <Input
              id="team"
              value={formData.team || ""}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. Engineering, Marketing"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Your registered billing address</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={formData.address || ""}
              onChange={handleChange}
              disabled={loading}
              placeholder="123 Main St, Suite 100"
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="Paris"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="France"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax & VAT</CardTitle>
          <CardDescription>Tax identification and VAT settings</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
            <Input
              id="vatNumber"
              value={formData.vatNumber || ""}
              onChange={handleChange}
              disabled={loading}
              placeholder="FR 12 345 678 901"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vatRate">Default VAT Rate (%)</Label>
            <Input
              id="vatRate"
              type="number"
              step="0.01"
              value={formData.vatRate}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>How you want to be paid</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="paymentMethod">Preferred Payment Method</Label>
              <Select
                value={formData.paymentMethod || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
                disabled={loading}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select preferred method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentAccount">Account Details / IBAN</Label>
              <Input
                id="paymentAccount"
                value={formData.paymentAccount || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="FR76 1234 5678 ..."
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="paypalEmail">PayPal Email (Optional)</Label>
              <Input
                id="paypalEmail"
                type="email"
                value={formData.paypalEmail || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="paypal@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeDoctorEmail">Time Doctor Email (Optional)</Label>
              <Input
                id="timeDoctorEmail"
                type="email"
                value={formData.timeDoctorEmail || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="timedoctor@example.com"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
            <Textarea
              id="paymentNotes"
              value={formData.paymentNotes || ""}
              onChange={handleChange}
              disabled={loading}
              placeholder="Any additional instructions for the finance team"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking Details</CardTitle>
          <CardDescription>Detailed information for international bank transfers</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={formData.bankName || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. PING AN BANK CO.,LTD"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="swiftCode">SWIFT / BIC Code</Label>
              <Input
                id="swiftCode"
                value={formData.swiftCode || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. SZDBCNBS"
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="postCode">Post Code</Label>
              <Input
                id="postCode"
                value={formData.postCode || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. 518000"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secondaryPayment">Secondary Payment Method (Optional)</Label>
            <Textarea
              id="secondaryPayment"
              value={formData.secondaryPayment || ""}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. AliPay: 86-13424371741 / user@email.com"
            />
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Crypto Details</h3>
              <p className="text-xs text-muted-foreground">Only fill these fields if crypto is your payment method.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cryptoCoin">Coin</Label>
                <Input
                  id="cryptoCoin"
                  value={formData.cryptoCoin || ""}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="e.g. USDT"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cryptoNetwork">Network</Label>
                <Input
                  id="cryptoNetwork"
                  value={formData.cryptoNetwork || ""}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="e.g. TRC20"
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="cryptoWallet">Wallet Address</Label>
                <Input
                  id="cryptoWallet"
                  value={formData.cryptoWallet || ""}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Wallet address"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
