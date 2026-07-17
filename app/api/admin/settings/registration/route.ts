import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { isRegistrationOpen, setRegistrationOpen } from "@/lib/app-config";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const [registrationOpen, pendingCount] = await Promise.all([
    isRegistrationOpen(),
    db.worker.count({ where: { userId: null } }),
  ]);

  return NextResponse.json({ registrationOpen, pendingCount });
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { registrationOpen } = await request.json();
  if (typeof registrationOpen !== "boolean") {
    return NextResponse.json({ error: "registrationOpen must be a boolean" }, { status: 400 });
  }

  await setRegistrationOpen(registrationOpen);
  return NextResponse.json({ success: true, registrationOpen });
}
