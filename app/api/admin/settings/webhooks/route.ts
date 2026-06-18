import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const configs = await db.webhookConfig.findMany({
      orderBy: { key: "asc" },
    });

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
