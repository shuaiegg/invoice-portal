import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const xeroError = url.searchParams.get("error");

  // Xero itself returned an error
  if (xeroError) {
    const desc = url.searchParams.get("error_description") || xeroError;
    return NextResponse.redirect(new URL(`/admin/settings/xero?error=${encodeURIComponent(desc)}`, request.url));
  }

  if (state !== "xero-connect") {
    return NextResponse.redirect(new URL("/admin/settings/xero?error=invalid_state", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/admin/settings/xero?error=missing_code", request.url));
  }

  // 1. Exchange code for tokens
  const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}));
    console.error("Xero token exchange failed:", errorData);
    const msg = errorData.error_description || errorData.error || "token_exchange_failed";
    return NextResponse.redirect(new URL(`/admin/settings/xero?error=${encodeURIComponent(msg)}`, request.url));
  }

  const tokenData = await tokenResponse.json();

  // 2. Fetch tenantId
  const connResponse = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!connResponse.ok) {
    return NextResponse.redirect(new URL("/admin/settings/xero?error=connections_fetch_failed", request.url));
  }

  const connections = await connResponse.json();
  const tenantId = connections[0]?.tenantId;

  if (!tenantId) {
    return NextResponse.redirect(new URL("/admin/settings/xero?error=no_tenant_found", request.url));
  }

  // 3. Upsert XeroToken
  await db.xeroToken.upsert({
    where: { id: "singleton" },
    update: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
      tenantId,
    },
    create: {
      id: "singleton",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
      tenantId,
    },
  });

  return NextResponse.redirect(new URL("/admin/settings/xero", request.url));
}
