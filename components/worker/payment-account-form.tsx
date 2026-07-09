"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PAYMENT_ACCOUNT_TYPE_LABELS,
  PAYMENT_ACCOUNT_TYPES,
  type PaymentAccountType,
  validatePaymentAccountInput,
} from "@/lib/payment-accounts";

export interface PaymentAccount {
  id: string;
  type: PaymentAccountType;
  label: string | null;
  isPreferred: boolean;
  accountNumber: string | null;
  bankName: string | null;
  swiftCode: string | null;
  email: string | null;
  cryptoCoin: string | null;
  cryptoNetwork: string | null;
  cryptoWallet: string | null;
  notes: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

type PaymentAccountFormData = {
  type: PaymentAccountType;
  label: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  email: string;
  cryptoCoin: string;
  cryptoNetwork: string;
  cryptoWallet: string;
  notes: string;
};

interface PaymentAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: PaymentAccount | null;
  onSaved: (account: PaymentAccount) => void;
}

const emptyForm: PaymentAccountFormData = {
  type: "BANK_TRANSFER",
  label: "",
  accountNumber: "",
  bankName: "",
  swiftCode: "",
  email: "",
  cryptoCoin: "",
  cryptoNetwork: "",
  cryptoWallet: "",
  notes: "",
};

function formFromAccount(account?: PaymentAccount | null): PaymentAccountFormData {
  if (!account) return emptyForm;

  return {
    type: account.type,
    label: account.label || "",
    accountNumber: account.accountNumber || "",
    bankName: account.bankName || "",
    swiftCode: account.swiftCode || "",
    email: account.email || "",
    cryptoCoin: account.cryptoCoin || "",
    cryptoNetwork: account.cryptoNetwork || "",
    cryptoWallet: account.cryptoWallet || "",
    notes: account.notes || "",
  };
}

export function PaymentAccountForm({
  open,
  onOpenChange,
  account,
  onSaved,
}: PaymentAccountFormProps) {
  const [formData, setFormData] = useState<PaymentAccountFormData>(() => formFromAccount(account));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(formFromAccount(account));
    }
  }, [account, open]);

  const updateField = (field: keyof PaymentAccountFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const missingFields = validatePaymentAccountInput(formData);
    if (missingFields.length > 0) {
      toast.error(`Missing required field(s): ${missingFields.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(account ? `/api/payment-accounts/${account.id}` : "/api/payment-accounts", {
        method: account ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save payment account");
      }

      toast.success(account ? "Payment method updated" : "Payment method added");
      onSaved(payload);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save payment account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{account ? "Edit Payment Method" : "Add Payment Method"}</SheetTitle>
          <SheetDescription>Choose the payment type and enter the required details.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-account-type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => updateField("type", value as PaymentAccountType)}
              disabled={loading}
            >
              <SelectTrigger id="payment-account-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PAYMENT_ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PAYMENT_ACCOUNT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-account-label">Label</Label>
            <Input
              id="payment-account-label"
              value={formData.label}
              onChange={(event) => updateField("label", event.target.value)}
              disabled={loading}
              placeholder="Main account"
            />
          </div>

          {formData.type === "BANK_TRANSFER" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-number">Account Number / IBAN</Label>
                <Input
                  id="payment-account-number"
                  value={formData.accountNumber}
                  onChange={(event) => updateField("accountNumber", event.target.value)}
                  disabled={loading}
                  required
                  placeholder="FR76 1234 5678 ..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-bank">Bank Name</Label>
                <Input
                  id="payment-account-bank"
                  value={formData.bankName}
                  onChange={(event) => updateField("bankName", event.target.value)}
                  disabled={loading}
                  placeholder="Bank name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-swift">SWIFT / BIC Code</Label>
                <Input
                  id="payment-account-swift"
                  value={formData.swiftCode}
                  onChange={(event) => updateField("swiftCode", event.target.value)}
                  disabled={loading}
                  placeholder="SWIFT code"
                />
              </div>
            </>
          )}

          {(formData.type === "WISE" || formData.type === "PAYPAL" || formData.type === "REVOLUT") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-account-email">Email</Label>
              <Input
                id="payment-account-email"
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                disabled={loading}
                required
                placeholder="worker@example.com"
              />
            </div>
          )}

          {formData.type === "OTHER" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-account-notes">Payment Details</Label>
              <Textarea
                id="payment-account-notes"
                value={formData.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                disabled={loading}
                rows={5}
                placeholder={"Include all details the finance team needs to pay you:\ne.g. full name, bank, account number, SWIFT/BIC, address, or any other instructions."}
              />
            </div>
          )}

          {formData.type !== "OTHER" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-account-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-account-notes"
                value={formData.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                disabled={loading}
                rows={2}
                placeholder="Any extra routing details or instructions"
              />
            </div>
          )}

          {formData.type === "CRYPTO" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-coin">Coin</Label>
                <Input
                  id="payment-account-coin"
                  value={formData.cryptoCoin}
                  onChange={(event) => updateField("cryptoCoin", event.target.value)}
                  disabled={loading}
                  required
                  placeholder="USDT"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-network">Network</Label>
                <Input
                  id="payment-account-network"
                  value={formData.cryptoNetwork}
                  onChange={(event) => updateField("cryptoNetwork", event.target.value)}
                  disabled={loading}
                  required
                  placeholder="TRC20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-account-wallet">Wallet Address</Label>
                <Input
                  id="payment-account-wallet"
                  value={formData.cryptoWallet}
                  onChange={(event) => updateField("cryptoWallet", event.target.value)}
                  disabled={loading}
                  required
                  placeholder="Wallet address"
                />
              </div>
            </>
          )}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
