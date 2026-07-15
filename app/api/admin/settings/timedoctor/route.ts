import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { isTokenExpiringSoon, testTimeDoctorConnection, tokenExpiryFromJwt } from "@/lib/timedoctor";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const config = await db.timeDoctorConfig.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(config ? {
    companyId: config.companyId, tokenExpiresAt: config.tokenExpiresAt,
    expiringSoon: isTokenExpiringSoon(config.tokenExpiresAt), lastSyncAt: config.lastSyncAt, lastSyncStatus: config.lastSyncStatus,
  } : null);
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const { apiToken, companyId } = await request.json();
  if (typeof apiToken !== "string" || !apiToken.trim() || typeof companyId !== "string" || !companyId.trim()) {
    return NextResponse.json({ error: "API token and company ID are required" }, { status: 400 });
  }
  try {
    await testTimeDoctorConnection(apiToken.trim(), companyId.trim());
    const config = await db.timeDoctorConfig.upsert({
      where: { id: "singleton" },
      create: { apiToken: apiToken.trim(), companyId: companyId.trim(), tokenExpiresAt: tokenExpiryFromJwt(apiToken.trim()) },
      update: { apiToken: apiToken.trim(), companyId: companyId.trim(), tokenExpiresAt: tokenExpiryFromJwt(apiToken.trim()) },
    });
    return NextResponse.json({ tokenExpiresAt: config.tokenExpiresAt, expiringSoon: isTokenExpiringSoon(config.tokenExpiresAt) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connection failed" }, { status: 400 });
  }
}
