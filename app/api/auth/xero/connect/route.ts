import { requireAdmin } from "@/lib/admin-guard";
import { getXeroRedirectUri } from "@/lib/xero";
import { NextResponse } from "next/server";

export async function GET() {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = getXeroRedirectUri();

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing env vars: XERO_CLIENT_ID must be set, and either XERO_REDIRECT_URI or NEXT_PUBLIC_APP_URL." },
      { status: 500 }
    );
  }

  const scopes = "openid profile email offline_access accounting.contacts accounting.invoices accounting.settings";
  const xeroAuthUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=xero-connect`;

  return NextResponse.redirect(xeroAuthUrl);
}
