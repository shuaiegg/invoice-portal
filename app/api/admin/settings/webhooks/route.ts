import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!

    const configs = await db.webhookConfig.findMany({
      orderBy: { key: "asc" },
    });

    // Mask URLs and DO NOT return secrets to the client.
    // Only surface non-sensitive metadata and flags so the admin UI
    // can show/identify configurations without leaking secrets.
    const maskedConfigs = configs.map((config) => ({
      key: config.key,
      environment: config.environment,
      url: config.url.length > 6 ? `****${config.url.slice(-6)}` : "****",
      enabled: config.enabled,
      lastTriggeredAt: config.lastTriggeredAt,
      updatedAt: config.updatedAt,
      hasSecret: !!config.secret,
      hasInternalSecret: !!config.internalSecret,
    }));

    return NextResponse.json(maskedConfigs);
  } catch (error) {
    console.error("Failed to fetch webhook configs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
