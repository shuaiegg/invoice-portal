import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configs = await db.webhookConfig.findMany({
      orderBy: { key: "asc" },
    });

    // Mask URLs to show only last 6 characters
    const maskedConfigs = configs.map((config) => ({
      ...config,
      url: config.url.length > 6 ? `****${config.url.slice(-6)}` : "****",
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
