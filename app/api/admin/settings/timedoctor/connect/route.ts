import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { isTokenExpiringSoon, loginToTimeDoctor } from "@/lib/timedoctor";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const { email, password } = await request.json();
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Time Doctor email and password are required" }, { status: 400 });
  }
  try {
    const { token, companyId, tokenExpiresAt } = await loginToTimeDoctor(email.trim(), password);
    const config = await db.timeDoctorConfig.upsert({
      where: { id: "singleton" },
      create: { apiToken: token, companyId, tokenExpiresAt },
      update: { apiToken: token, companyId, tokenExpiresAt },
    });
    return NextResponse.json({
      companyId: config.companyId,
      tokenExpiresAt: config.tokenExpiresAt,
      expiringSoon: isTokenExpiringSoon(config.tokenExpiresAt),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connection failed" }, { status: 400 });
  }
}
