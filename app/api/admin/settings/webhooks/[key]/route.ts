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

    // Try to find existing config so we can perform a selective update
    // without exposing or overwriting secrets when the admin leaves
    // the secret inputs blank in the UI.
    const existing = await db.webhookConfig.findUnique({
      where: {
        key_environment: { key, environment },
      },
    });

    if (existing) {
      const updateData: any = {
        url,
        enabled,
        environment,
      };

      // Only update secrets if the client provided them (allows "leave blank to keep current")
      if (secret !== undefined) updateData.secret = secret;
      if (internalSecret !== undefined) updateData.internalSecret = internalSecret;

      const updatedConfig = await db.webhookConfig.update({
        where: {
          key_environment: { key, environment },
        },
        data: updateData,
      });

      return NextResponse.json(updatedConfig);
    }

    // Create new record if none exists
    const created = await db.webhookConfig.create({
      data: {
        key,
        url,
        enabled,
        environment,
        secret: secret || null,
        internalSecret: internalSecret || null,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Failed to update webhook config:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
