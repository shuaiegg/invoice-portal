"use client";

import { useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  details: Record<string, unknown>;
  createdAt: string;
};

function ActionBadge({ action }: { action: string }) {
  if (action === "INVOICE_STATUS_CHANGED") {
    return <Badge className="bg-blue-100 text-blue-800">Invoice Status</Badge>;
  }
  if (action === "USER_ROLE_CHANGED") {
    return <Badge className="bg-purple-100 text-purple-800">Role Change</Badge>;
  }
  return <Badge variant="outline">{action}</Badge>;
}

function formatDetails(log: AuditLogRow): string {
  const d = log.details;
  if (log.action === "INVOICE_STATUS_CHANGED") {
    const bulk = d.bulk ? " (bulk)" : "";
    return `${d.invoiceNumber} · ${d.workerName} · ${d.from} → ${d.to}${bulk}`;
  }
  if (log.action === "USER_ROLE_CHANGED") {
    return `${d.userEmail} · ${d.from} → ${d.to}`;
  }
  return JSON.stringify(d);
}

export function AuditLogTable({
  logs,
  total,
  page,
  pageSize,
  actionFilter,
}: {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  actionFilter?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / pageSize);

  function navigate(newPage: number, action?: string) {
    const params = new URLSearchParams();
    if (newPage > 1) params.set("page", String(newPage));
    if (action && action !== "ALL") params.set("action", action);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={actionFilter ?? "ALL"}
          onValueChange={(val) => navigate(1, val)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            <SelectItem value="INVOICE_STATUS_CHANGED">Invoice Status</SelectItem>
            <SelectItem value="USER_ROLE_CHANGED">Role Change</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No audit entries yet
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-GB", {
                      timeZone: "Europe/Paris",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{log.actorName}</TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDetails(log)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(page - 1, actionFilter)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(page + 1, actionFilter)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
