"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "WORKER";
  createdAt: string;
  isInitial: boolean;
  isSelf: boolean;
  workerName: string | null;
};

export function UserRolePanel({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRoleChange(user: UserRow, newRole: "ADMIN" | "WORKER") {
    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success(
        newRole === "ADMIN"
          ? `${user.name ?? user.email} promoted to Admin`
          : `${user.name ?? user.email} demoted to Worker`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead className="w-36"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              {user.workerName ?? user.name ?? "—"}
              {user.isInitial && (
                <span className="ml-2 text-xs text-muted-foreground">(initial)</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              {user.role === "ADMIN" ? (
                <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
              ) : (
                <Badge variant="outline">Worker</Badge>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString("en-GB", { timeZone: "Europe/Paris" })}
            </TableCell>
            <TableCell>
              {user.isSelf || user.isInitial ? (
                <span className="text-xs text-muted-foreground">
                  {user.isSelf ? "You" : "Protected"}
                </span>
              ) : user.role === "WORKER" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRoleChange(user, "ADMIN")}
                  disabled={pendingId === user.id}
                >
                  {pendingId === user.id
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <Shield className="w-3 h-3 mr-1" />}
                  Make Admin
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRoleChange(user, "WORKER")}
                  disabled={pendingId === user.id}
                  className="text-red-600 hover:text-red-700"
                >
                  {pendingId === user.id
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <ShieldOff className="w-3 h-3 mr-1" />}
                  Remove Admin
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
