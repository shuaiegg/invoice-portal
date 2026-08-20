"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, AlertTriangle, AlertCircle, Loader2, Play, RefreshCw, Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type AnomalyFlag = {
  id: string;
  type: "HOUR_DEVIATION" | "AMOUNT_CEILING" | "MISSING_TD_DATA";
  severity: "HIGH" | "MEDIUM";
  details: string;
  workerName: string | null;
  invoiceNumber: string | null;
};

type RunData = {
  id: string;
  billingMonth: string;
  status: "RUNNING" | "RUN_PAUSED" | "COMPLETED" | "FAILED";
  completedAt: string | null;
  createdAt: string;
  anomalyFlags: AnomalyFlag[];
};

type ReportData = {
  year: number;
  month: number;
  totalAmount: number;
  workerCount: number;
  currencyBreakdown: Record<string, number>;
  xeroStatus: string | null;
  generatedAt: string;
};

const TYPE_LABEL: Record<AnomalyFlag["type"], string> = {
  HOUR_DEVIATION: "Hour deviation",
  AMOUNT_CEILING: "Amount ceiling",
  MISSING_TD_DATA: "Missing TD data",
};

function parseDetails(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function formatDetails(flag: AnomalyFlag): string {
  const d = parseDetails(flag.details);
  if (flag.type === "HOUR_DEVIATION")
    return `${d.currentHours}h this month vs ${d.avgHours}h avg (+${d.deviationPct}% deviation)`;
  if (flag.type === "AMOUNT_CEILING")
    return `${d.currency} ${Number(d.totalAmount).toFixed(2)} exceeds ceiling of €${Number(d.ceiling).toLocaleString()}`;
  if (flag.type === "MISSING_TD_DATA")
    return "No Time Doctor hours recorded this month";
  return flag.details;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}-02`));
}

function formatAmount(totalAmount: number, breakdown: Record<string, number>) {
  const currencies = Object.keys(breakdown);
  if (currencies.length === 1)
    return `${currencies[0]} ${totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return currencies
    .map((c) => `${c} ${breakdown[c].toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(" · ");
}

function RunStatusBadge({ status }: { status: RunData["status"] }) {
  if (status === "COMPLETED") return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
  if (status === "RUNNING") return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
  return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
}

export function AutomationPanel({
  billingMonth,
  availableMonths,
  run: initialRun,
  report: initialReport,
}: {
  billingMonth: string;
  availableMonths: string[];
  run: RunData | null;
  report: ReportData | null;
}) {
  const router = useRouter();
  const [runStarting, setRunStarting] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [report, setReport] = useState(initialReport);
  const run = initialRun;

  const [year, month] = billingMonth.split("-").map(Number);

  function handleMonthChange(value: string) {
    router.push(`/admin/automation?month=${value}`);
  }

  async function handleRunAutomation() {
    setRunStarting(true);
    try {
      const res = await fetch("/api/admin/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to start");
      toast.success("Automation run started — this may take a few minutes. Refresh to see the result.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setRunStarting(false);
    }
  }

  async function handleGenerateReport() {
    setReportGenerating(true);
    try {
      const res = await fetch(`/api/admin/reports/${year}/${month}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      setReport({
        year: data.year,
        month: data.month,
        totalAmount: data.totalAmount,
        workerCount: data.workerCount,
        currencyBreakdown: data.currencyBreakdown,
        xeroStatus: data.xeroStatus,
        generatedAt: data.generatedAt,
      });
      toast.success("Report generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setReportGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Billing month:</span>
        <Select value={billingMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Automation run section */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Automation Run</CardTitle>
            <CardDescription>
              {run
                ? <>Started {new Date(run.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Paris" })}
                    {run.completedAt && <span className="block mt-0.5">Completed {new Date(run.completedAt).toLocaleString("en-GB", { timeZone: "Europe/Paris" })}</span>}
                  </>
                : "No run found for this month."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {run && <RunStatusBadge status={run.status} />}
            {!run && (
              <Button size="sm" onClick={handleRunAutomation} disabled={runStarting}>
                {runStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Run automation
              </Button>
            )}
          </div>
        </CardHeader>

        {run?.status === "COMPLETED" && (
          <CardContent>
            {run.anomalyFlags.length === 0 ? (
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                No anomalies detected. Invoices are ready for review and approval.
              </p>
            ) : (
              <p className="text-sm text-yellow-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {run.anomalyFlags.filter((f) => f.severity === "HIGH").length > 0
                  ? `${run.anomalyFlags.filter((f) => f.severity === "HIGH").length} HIGH anomaly detected — review before approving invoices.`
                  : `${run.anomalyFlags.length} informational anomaly detected.`}
              </p>
            )}
          </CardContent>
        )}

        {run?.status === "FAILED" && (
          <CardContent>
            <p className="text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Run failed. You can start a new run below.
            </p>
            <Button size="sm" className="mt-3" onClick={handleRunAutomation} disabled={runStarting}>
              {runStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Run again
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Anomaly table */}
      {run && run.anomalyFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anomalies ({run.anomalyFlags.length})</CardTitle>
            <CardDescription>Review before approving invoices. HIGH items warrant closer inspection.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.anomalyFlags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-medium">{flag.workerName ?? "—"}</TableCell>
                    <TableCell>{TYPE_LABEL[flag.type]}</TableCell>
                    <TableCell>
                      {flag.severity === "HIGH"
                        ? <Badge className="bg-red-100 text-red-800">HIGH</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-800">MEDIUM</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDetails(flag)}</TableCell>
                    <TableCell className="text-sm">{flag.invoiceNumber ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Report section */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Monthly Report</CardTitle>
            <CardDescription>
              {report
                ? `Generated ${new Date(report.generatedAt).toLocaleDateString("en-GB", { timeZone: "Europe/Paris" })}`
                : "No report generated yet for this month."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/admin/reports/${year}/${month}/csv`} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={reportGenerating}>
              {reportGenerating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <RefreshCw className="w-4 h-4 mr-2" />}
              {report ? "Regenerate" : "Generate report"}
            </Button>
          </div>
        </CardHeader>

        {report && (
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total paid</p>
                <p className="font-medium mt-0.5">{formatAmount(report.totalAmount, report.currencyBreakdown)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Workers paid</p>
                <p className="font-medium mt-0.5">{report.workerCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Xero status</p>
                <Badge className={report.xeroStatus === "All synced" ? "bg-green-100 text-green-800 mt-0.5" : "bg-yellow-100 text-yellow-800 mt-0.5"}>
                  {report.xeroStatus ?? "—"}
                </Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
