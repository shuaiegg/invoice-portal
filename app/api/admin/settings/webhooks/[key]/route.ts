import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import type { Prisma } from "@/lib/generated/client/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { key } = await params;
    const body = await request.json();
    const { url, enabled, environment, secret, internalSecret } = body;

    const existing = await db.webhookConfig.findUnique({
      where: { key_environment: { key, environment } },
    });

    if (existing) {
      const updateData: Prisma.WebhookConfigUpdateInput = { url, enabled, environment };
      if (secret !== undefined) updateData.secret = secret;
      if (internalSecret !== undefined) updateData.internalSecret = internalSecret;

      const updated = await db.webhookConfig.update({
        where: { key_environment: { key, environment } },
        data: updateData,
      });
      return NextResponse.json(updated);
    }

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
