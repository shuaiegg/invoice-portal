import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Redeems a claim token issued by "Add worker" (openspec/changes/close-worker-registration).
// Deliberately thin: calls the same auth.api.signUpEmail the public /register form uses, so the
// existing after:create claim hook (claimPreprovisionedWorker) links the Worker exactly as
// normal — this route's only job is validating the token and supplying the pre-provisioned email.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const worker = await db.worker.findUnique({
    where: { claimToken: token },
    select: { id: true, name: true, userId: true, timeDoctorEmail: true, claimTokenExpiresAt: true },
  });

  const invalid = !worker || worker.userId !== null || !worker.timeDoctorEmail
    || !worker.claimTokenExpiresAt || worker.claimTokenExpiresAt <= new Date();
  if (invalid) {
    return NextResponse.json({ error: "This invite link is invalid or has expired. Contact your administrator for a new one." }, { status: 410 });
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : worker!.name;

  try {
    const { headers: authHeaders, response } = await auth.api.signUpEmail({
      body: { name, email: worker!.timeDoctorEmail!, password },
      headers: await headers(),
      returnHeaders: true,
    });

    // Hygiene, not the primary guard — claimPreprovisionedWorker's own userId-still-null check
    // (inside the after:create hook it ran as part of signUpEmail above) is what actually
    // prevents a double-claim; this just stops the token from being shown/reused afterward.
    await db.worker.updateMany({
      where: { id: worker!.id, userId: { not: null } },
      data: { claimToken: null, claimTokenExpiresAt: null },
    });

    const nextResponse = NextResponse.json({ success: true, user: response.user });
    const setCookie = authHeaders.get("set-cookie");
    if (setCookie) nextResponse.headers.set("set-cookie", setCookie);
    return nextResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
