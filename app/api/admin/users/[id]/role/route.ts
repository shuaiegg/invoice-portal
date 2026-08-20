import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { logUserRoleChanged } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id: targetUserId } = await params;
  const actorId = guard.session!.user.id;
  const actorName = guard.session!.user.name ?? guard.session!.user.email;

  // Cannot change own role
  if (targetUserId === actorId) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { role } = body as { role?: unknown };
  if (role !== "ADMIN" && role !== "WORKER") {
    return NextResponse.json({ error: "role must be ADMIN or WORKER" }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Protect initial account (earliest createdAt) from demotion
  if (role === "WORKER") {
    const firstUser = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (firstUser?.id === targetUserId) {
      return NextResponse.json(
        { error: "The initial admin account cannot be demoted" },
        { status: 403 }
      );
    }
  }

  if (targetUser.role === role) {
    return NextResponse.json({ error: "User already has this role" }, { status: 409 });
  }

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  await logUserRoleChanged(actorId, actorName, targetUserId, {
    userEmail: targetUser.email,
    userName: targetUser.name ?? targetUser.email,
    from: targetUser.role,
    to: role,
  });

  return NextResponse.json(updated);
}
