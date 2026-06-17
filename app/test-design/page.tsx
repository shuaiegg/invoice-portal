"use client";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function TestPage() {
  return (
    <div className="p-8 space-y-12">
      <PageHeader 
        title="Design System Test" 
        subtitle="Verification of brand tokens and shared components"
        action={<Button><Plus className="mr-2 h-4 w-4" /> Action Button</Button>}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Brand Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-primary text-white rounded">Primary (#00A0FF)</div>
          <div className="p-4 bg-accent text-foreground rounded">Accent (#F2F2F3)</div>
          <div className="p-4 bg-success text-white rounded">Success (#22C55E)</div>
          <div className="p-4 bg-error text-white rounded">Error (#EF4444)</div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Status Badges</h2>
        <div className="flex gap-4">
          <StatusBadge status="SUBMITTED" />
          <StatusBadge status="APPROVED" />
          <StatusBadge status="PAID" />
          <StatusBadge status="VOID" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Empty State</h2>
        <EmptyState 
          message="No invoices found" 
          description="You haven't submitted any invoices yet. Click the button below to create your first one."
          action={<Button variant="outline">Create Invoice</Button>}
        />
      </section>
    </div>
  );
}
