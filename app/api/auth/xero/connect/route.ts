import { requireAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

export async function GET() {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing env vars: XERO_CLIENT_ID and XERO_REDIRECT_URI must be set." },
      { status: 500 }
    );
  }

  const scopes = "openid profile email offline_access accounting.contacts accounting.invoices accounting.settings";
  const xeroAuthUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=xero-connect`;

  return NextResponse.redirect(xeroAuthUrl);
}
