"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const statuses = [
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Paid", value: "PAID" },
  { label: "Void", value: "VOID" },
];

export function InvoiceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [workerName, setWorkerName] = useState(searchParams.get("workerName") || "");
  const [period, setPeriod] = useState(searchParams.get("period") || "");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    searchParams.get("status")?.split(",").filter(Boolean) || []
  );

  const updateFilters = (updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 on filter change
    params.set("page", "1");
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const nextStatuses = checked
      ? [...selectedStatuses, status]
      : selectedStatuses.filter((s) => s !== status);
    
    setSelectedStatuses(nextStatuses);
    updateFilters({ status: nextStatuses });
  };

  const clearFilters = () => {
    setWorkerName("");
    setPeriod("");
    setSelectedStatuses([]);
    router.push(pathname);
  };

  return (
    <div className="bg-white p-6 rounded-xl border space-y-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="workerName">Worker Name</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="workerName"
              placeholder="Search by name..."
              className="pl-9 bg-accent/30"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateFilters({ workerName })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">Billing Period</Label>
          <Input
            id="period"
            placeholder="e.g. June 2026"
            className="bg-accent/30"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && updateFilters({ period })}
          />
        </div>

        <div className="flex items-end">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => updateFilters({ workerName, period })}
          >
            Apply Search
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Status</Label>
        <div className="flex flex-wrap gap-6">
          {statuses.map((status) => (
            <div key={status.value} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status.value}`}
                checked={selectedStatuses.includes(status.value)}
                onCheckedChange={(checked) => handleStatusChange(status.value, !!checked)}
              />
              <label
                htmlFor={`status-${status.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {status.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {(workerName || period || selectedStatuses.length > 0) && (
        <div className="pt-2 border-t flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-2 h-4 w-4" />
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
