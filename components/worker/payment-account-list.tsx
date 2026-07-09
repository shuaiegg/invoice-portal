"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CreditCard, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  PaymentAccountForm,
  type PaymentAccount,
} from "@/components/worker/payment-account-form";
import {
  formatPaymentAccountKeyDetail,
  PAYMENT_ACCOUNT_TYPE_LABELS,
} from "@/lib/payment-accounts";

interface PaymentAccountListProps {
  accounts: PaymentAccount[];
  hasLegacyPaymentData: boolean;
}

export function PaymentAccountList({
  accounts: initialAccounts,
  hasLegacyPaymentData,
}: PaymentAccountListProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refreshAccounts = async () => {
    const response = await fetch("/api/payment-accounts");
    if (!response.ok) throw new Error("Failed to refresh payment methods");
    setAccounts(await response.json());
    router.refresh();
  };

  const openAddForm = () => {
    setEditingAccount(null);
    setFormOpen(true);
  };

  const openEditForm = (account: PaymentAccount) => {
    setEditingAccount(account);
    setFormOpen(true);
  };

  const handleSaved = async () => {
    await refreshAccounts();
  };

  const handleSetPreferred = async (account: PaymentAccount) => {
    setLoadingId(account.id);
    try {
      const response = await fetch(`/api/payment-accounts/${account.id}/prefer`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update preferred payment method");
      }
      toast.success("Preferred payment method updated");
      await refreshAccounts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update preferred payment method");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (account: PaymentAccount) => {
    if (!window.confirm("Delete this payment method?")) return;

    setLoadingId(account.id);
    try {
      const response = await fetch(`/api/payment-accounts/${account.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete payment method");
      }
      toast.success("Payment method deleted");
      await refreshAccounts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete payment method");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Payment Methods</h2>
          <p className="text-sm text-muted-foreground">Manage the accounts finance can use to pay you</p>
        </div>
        <Button type="button" onClick={openAddForm}>
          <Plus data-icon="inline-start" />
          Add Payment Method
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {hasLegacyPaymentData && accounts.length === 0 && (
          <Alert>
            <AlertCircle />
            <AlertTitle>Existing payment details need to be re-entered</AlertTitle>
            <AlertDescription>
              Your older profile has payment fields saved, but no new payment methods yet.
            </AlertDescription>
          </Alert>
        )}

        {accounts.length === 0 ? (
          <EmptyState
            message="No payment methods added"
            description="Add a bank, Wise, PayPal, crypto, or Revolut account."
            icon={<CreditCard className="size-12 text-muted-foreground" />}
            action={
              <Button type="button" onClick={openAddForm}>
                <Plus data-icon="inline-start" />
                Add Payment Method
              </Button>
            }
            className="rounded-lg"
          />
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <Card key={account.id} data-testid={`payment-account-card-${account.id}`}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <CreditCard className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {account.label || PAYMENT_ACCOUNT_TYPE_LABELS[account.type]}
                        </CardTitle>
                        <Badge variant="secondary">{PAYMENT_ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                        {account.isPreferred && (
                          <Badge>
                            <CheckCircle2 data-icon="inline-start" />
                            Preferred
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="break-all">
                        {formatPaymentAccountKeyDetail(account)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!account.isPreferred && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPreferred(account)}
                        disabled={loadingId === account.id}
                        data-testid={`payment-account-prefer-${account.id}`}
                      >
                        <Star data-icon="inline-start" />
                        Set as Preferred
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openEditForm(account)}
                      disabled={loadingId === account.id}
                      aria-label="Edit payment method"
                      data-testid={`payment-account-edit-${account.id}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => handleDelete(account)}
                      disabled={loadingId === account.id}
                      aria-label="Delete payment method"
                      data-testid={`payment-account-delete-${account.id}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PaymentAccountForm
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editingAccount}
        onSaved={handleSaved}
      />
    </section>
  );
}
