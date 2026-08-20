import { generateMonthlyReport } from "@/lib/report-generator";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Fires on the 2nd of each month at 08:00 UTC — after finance has had time to
// mark July invoices PAID on the 1st before the report captures the final state.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Report covers the month before the current one
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;

  const report = await generateMonthlyReport(year, month);
  return NextResponse.json({ ok: true, report });
}
