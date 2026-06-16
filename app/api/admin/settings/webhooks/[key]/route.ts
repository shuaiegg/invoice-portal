import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await params;
    const body = await request.json();
    const { url, enabled, environment, secret, internalSecret } = body;

    const updatedConfig = await db.webhookConfig.upsert({
      where: { key },
      update: {
        url,
        enabled,
        environment,
        secret,
        internalSecret,
      },
      create: {
        key,
        url,
        enabled,
        environment,
        secret,
        internalSecret,
      },
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("Failed to update webhook config:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
