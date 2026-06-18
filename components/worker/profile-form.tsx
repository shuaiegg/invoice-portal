"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

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
    } catch (error: any) {
      toast.error(error.message);
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
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Input
                id="paymentMethod"
                value={formData.paymentMethod || ""}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. Bank Transfer, PayPal"
              />
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
