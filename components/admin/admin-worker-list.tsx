"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCheck, UserX, ExternalLink, Clock } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface AdminWorkerListProps {
  workers: any[];
}

const PAYMENT_METHOD_FILTERS = ["Wise", "PayPal", "Manual"];

export function AdminWorkerList({ workers }: AdminWorkerListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const paymentMethod = searchParams.get("paymentMethod") || "all";

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = () => updateParams({ search });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or team..."
            className="pl-9 bg-accent/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Select value={paymentMethod} onValueChange={(value) => updateParams({ paymentMethod: value })}>
          <SelectTrigger className="w-44 bg-accent/30">
            <SelectValue placeholder="Payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment methods</SelectItem>
            {PAYMENT_METHOD_FILTERS.map((method) => (
              <SelectItem key={method} value={method}>{method}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50">
              <TableHead>Worker Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead>Last Submission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No workers found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              workers.map((worker) => (
                <TableRow 
                  key={worker.id} 
                  className="cursor-pointer hover:bg-accent/30 transition-colors group"
                  onClick={() => router.push(`/admin/workers/${worker.id}`)}
                >
                  <TableCell className="font-bold">{worker.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{worker.team || "No Team"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={worker.paymentMethod ? "secondary" : "outline"}>
                      {worker.paymentMethod || "Not set"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-secondary-text">{worker.email}</TableCell>
                  <TableCell className="text-center font-medium">{worker.invoiceCount}</TableCell>
                  <TableCell className="text-sm text-secondary-text">{formatDate(worker.lastSubmission)}</TableCell>
                  <TableCell>
                    {!worker.claimed ? (
                      <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 gap-1.5">
                        <Clock className="h-3 w-3" /> Pending registration
                      </Badge>
                    ) : worker.active ? (
                      <Badge variant="outline" className="text-success border-success/30 bg-success/5 gap-1.5">
                        <UserCheck className="h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-error border-error/30 bg-error/5 gap-1.5">
                        <UserX className="h-3 w-3" /> Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="group-hover:text-primary transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
