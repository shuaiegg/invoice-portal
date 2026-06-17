import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@/lib/generated/client/enums";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const statusConfig: Record<InvoiceStatus, { label: string; variant: "secondary" | "default" | "success" | "destructive" }> = {
  SUBMITTED: { label: "Submitted", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
  PAID: { label: "Paid", variant: "success" },
  VOID: { label: "Void", variant: "destructive" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" };

  return (
    <Badge variant={config.variant} className={cn("capitalize", className)}>
      {config.label}
    </Badge>
  );
}
