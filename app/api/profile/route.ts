import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePaymentType } from "@/lib/payment-types";
import { optionalString } from "@/lib/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const worker = await db.worker.findUnique({
    where: { userId: session.user.id },
  });

  // No auto-create fallback: a Worker row only exists here if the sign-up `after:create` hook
  // (claimPreprovisionedWorker) already claimed a pre-provisioned one for this email. If it
  // didn't, there's no legitimate claim — silently vivifying one is exactly the gap that let any
  // authenticated user obtain a working profile regardless of any real relationship to the
  // company. See openspec/changes/td-sync-worker-onboarding.
  if (!worker) {
    return NextResponse.json(
      { error: "not_recognized", message: "Your account isn't linked to a worker profile. Contact your administrator." },
      { status: 404 },
    );
  }

  return NextResponse.json(worker);
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const data = await req.json();
  const paymentType = parsePaymentType(data.paymentType);

  // Validate required fields (name is required by schema)
  if (!data.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (data.paymentType && !paymentType) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  // timeDoctorEmail is intentionally not in this list — it's the identity key pre-provisioned
  // workers are claimed by, and is admin-managed only (see PUT /api/admin/workers/[id]) since a
  // worker editing their own would let them collide with someone else's TD email.
  const profileData = {
    name: data.name,
    team: optionalString(data.team),
    address: optionalString(data.address),
    city: optionalString(data.city),
    country: optionalString(data.country),
    vatNumber: optionalString(data.vatNumber),
    vatRate: parseFloat(data.vatRate) || 0,
    paymentNotes: optionalString(data.paymentNotes),
    ...(paymentType ? { paymentType } : {}),
  };

  // No upsert/auto-create: a Worker row must already exist (claimed at sign-up) — see the
  // matching note on GET, above.
  const existing = await db.worker.findUnique({ where: { userId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json(
      { error: "not_recognized", message: "Your account isn't linked to a worker profile. Contact your administrator." },
      { status: 404 },
    );
  }

  const worker = await db.worker.update({ where: { userId }, data: profileData });

  return NextResponse.json(worker);
}
