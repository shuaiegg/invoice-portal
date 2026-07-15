import { runTdSync } from "@/lib/td-sync";
import { after, NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  after(() => runTdSync({ year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1 }));
  return NextResponse.json({ started: true }, { status: 200 });
}
