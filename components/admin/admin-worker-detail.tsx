"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  History
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AdminInvoiceTable } from "./admin-invoice-table";
import { PAYMENT_TYPE_LABELS } from "@/lib/payment-types";
import {
  formatPaymentAccountKeyDetail,
  PAYMENT_ACCOUNT_TYPE_LABELS,
} from "@/lib/payment-accounts";

interface AdminWorkerDetailProps {
  worker: any;
}

export function AdminWorkerDetail({ worker }: AdminWorkerDetailProps) {
  const router = useRouter();
  const [active, setActive] = useState(worker.user?.active ?? false);
  const [paymentType, setPaymentType] = useState(worker.paymentType || "MANUAL");
  const [timeDoctorEmail, setTimeDoctorEmail] = useState(worker.timeDoctorEmail || "");
  const [hourlyRate, setHourlyRate] = useState(worker.hourlyRate?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const paymentAccounts = worker.paymentAccounts || [];
  const preferredAccount = paymentAccounts.find((account: any) => account.isPreferred);

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/workers/${worker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });

      if (!response.ok) throw new Error("Failed to update worker status");

      setActive(!active);
      toast.success(`Worker ${!active ? "activated" : "deactivated"} successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentProfile = async () => {
    setProfileLoading(true);
    try {
      const response = await fetch(`/api/admin/workers/${worker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentType,
          timeDoctorEmail,
          ...(hourlyRate !== "" ? { hourlyRate: Number(hourlyRate) } : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update payment profile");
      }

      toast.success("Payment profile updated");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update payment profile");
    } finally {
      setProfileLoading(false);
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Link href="/admin/workers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workers
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-secondary-text">Account Status:</span>
          {active ? (
            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/10">Active</Badge>
          ) : (
            <Badge className="bg-error/10 text-error border-error/20 hover:bg-error/10">Inactive</Badge>
          )}
          <Button 
            variant={active ? "destructive" : "default"} 
            size="sm"
            onClick={handleToggleActive}
            disabled={loading}
          >
            {loading ? "Updating..." : active ? "Deactivate Account" : "Activate Account"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8">
          {/* Profile Card */}
          <Card>
            <CardHeader className="bg-accent/10 border-b">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{worker.name}</CardTitle>
                  <CardDescription>{worker.user ? `Joined ${formatDate(worker.user.createdAt)}` : "Pending registration"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-secondary-text mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-secondary-text tracking-wider">Email</div>
                    <div className="text-sm font-medium">{worker.user?.email || worker.timeDoctorEmail}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-secondary-text mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-secondary-text tracking-wider">Team</div>
                    <div className="text-sm font-medium">{worker.team || "No Team Assigned"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-secondary-text mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-secondary-text tracking-wider">Address</div>
                    <div className="text-sm font-medium leading-tight">
                      {worker.address || "N/A"}<br />
                      {worker.city && worker.country ? `${worker.city}, ${worker.country}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="h-4 w-4 text-secondary-text mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-secondary-text tracking-wider">Payment</div>
                    <Badge variant={paymentType === "MANUAL" ? "outline" : "secondary"} className="mb-1">
                      {PAYMENT_TYPE_LABELS[paymentType as keyof typeof PAYMENT_TYPE_LABELS] || "Manual"}
                    </Badge>
                    {preferredAccount ? (
                      <>
                        <Badge variant="outline" className="mb-1 ml-1 font-semibold">
                          {PAYMENT_ACCOUNT_TYPE_LABELS[preferredAccount.type as keyof typeof PAYMENT_ACCOUNT_TYPE_LABELS]}
                        </Badge>
                        <div className="text-xs font-mono text-secondary-text break-all">
                          {formatPaymentAccountKeyDetail(preferredAccount)}
                        </div>
                      </>
                    ) : paymentAccounts.length > 0 ? (
                      <div className="text-xs text-muted-foreground">No preferred account set</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No payment accounts added</div>
                    )}
                    {timeDoctorEmail && (
                      <div className="text-xs text-secondary-text break-all">TD: {timeDoctorEmail}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Routing</CardTitle>
              <CardDescription>Controls Time Doctor and manual payment handling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="paymentType">Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger id="paymentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TD_ONLY">TD Only</SelectItem>
                    <SelectItem value="TD_PLUS">TD Plus</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Hourly Rate</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Source: {worker.hourlyRateSource === "MANUAL" ? "Portal override" : "TD import"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeDoctorEmail">Time Doctor Email</Label>
                <Input
                  id="timeDoctorEmail"
                  type="email"
                  value={timeDoctorEmail}
                  onChange={(e) => setTimeDoctorEmail(e.target.value)}
                  placeholder="timedoctor@example.com"
                />
              </div>
              <Button className="w-full" onClick={handleSavePaymentProfile} disabled={profileLoading}>
                {profileLoading ? "Saving..." : "Save Payment Routing"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-secondary-text" />
            <h2 className="text-2xl font-bold tracking-tight text-text">Invoice History</h2>
          </div>
          
          <AdminInvoiceTable
            invoices={worker.invoices.map((inv: any) => ({ ...inv, worker }))}
            total={worker.invoices.length}
            page={1}
            pageSize={worker.invoices.length || 1}
            totalPages={1}
          />
        </div>
      </div>
    </div>
  );
}
