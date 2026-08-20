import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { generateMonthlyReport } from "@/lib/report-generator";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { year: yearStr, month: monthStr } = await params;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const report = await db.monthlyReport.findUnique({ where: { year_month: { year, month } } });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  return NextResponse.json(report);
}

// POST regenerates the report on demand (e.g. if invoices were marked PAID after the cron ran)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { year: yearStr, month: monthStr } = await params;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const report = await generateMonthlyReport(year, month);
  return NextResponse.json(report);
}
