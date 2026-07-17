"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { PaymentAccountList } from "@/components/worker/payment-account-list";
import type { PaymentAccount } from "@/components/worker/payment-account-form";

interface ProfileFormProps {
  initialData: {
    name: string;
    team: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    vatNumber: string | null;
    vatRate: number;
    paymentNotes: string | null;
    timeDoctorEmail: string | null;
  };
  paymentAccounts: PaymentAccount[];
  hasLegacyPaymentData: boolean;
}

export function ProfileForm({ initialData, paymentAccounts, hasLegacyPaymentData }: ProfileFormProps) {
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

      <PaymentAccountList
        accounts={paymentAccounts}
        hasLegacyPaymentData={hasLegacyPaymentData}
      />

      <Card>
        <CardHeader>
          <CardTitle>Payment Notes</CardTitle>
          <CardDescription>Optional routing details outside payment methods</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {formData.timeDoctorEmail ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="timeDoctorEmail">Time Doctor Email</Label>
                <Input id="timeDoctorEmail" type="email" value={formData.timeDoctorEmail} disabled readOnly />
                <p className="text-xs text-secondary-text">Managed by your administrator — contact them to change this.</p>
              </div>
            </div>
          ) : null}
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
