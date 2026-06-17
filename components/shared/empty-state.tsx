import React from "react";
import { cn } from "@/lib/utils";
import { FileQuestion } from "lucide-react";

interface EmptyStateProps {
  message: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ 
  message, 
  description, 
  action, 
  icon = <FileQuestion className="w-12 h-12 text-muted-foreground" />, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted text-center", className)}>
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-foreground">{message}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
