import { StatusBadge } from "@/components/shared/status-badge";
import { formatDistanceToNow } from "date-fns";
import type { Invoice } from "@/lib/generated/client/client";

interface ActivityFeedProps {
  invoices: (Invoice & { worker: { name: string } })[];
}

export function ActivityFeed({ invoices }: ActivityFeedProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-text">
        No recent activity found.
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <div 
          key={invoice.id} 
          className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col gap-1">
            <div className="font-bold text-text">{invoice.worker.name}</div>
            <div className="text-sm text-secondary-text">
              {invoice.invoiceNumber} • {invoice.period}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-bold">{formatCurrency(invoice.totalAmount)}</div>
              <div className="text-xs text-secondary-text">
                {formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true })}
              </div>
            </div>
            <StatusBadge status={invoice.status} className="w-24 justify-center" />
          </div>
        </div>
      ))}
    </div>
  );
}
