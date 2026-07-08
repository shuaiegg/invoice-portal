## 1. Database Schema

- [ ] 1.1 Add `AutomationConfig` model (hourDeviationThreshold, amountCeiling, resumeRequiresConfirmation)
- [ ] 1.2 Add `AnomalyFlag` model (id, runId, invoiceId, workerId, type, severity, details, reviewedAt, reviewedBy)
- [ ] 1.3 Add `MonthlyReport` model (id, year, month, generatedAt, totalAmount, workerCount, currencyBreakdown JSON, xeroStatus)
- [ ] 1.4 Add `AutomationRun` model (id, year, month, status, pausedAt, pauseReason, resumedAt, resumedBy, completedAt)
- [ ] 1.5 Run `npx prisma migrate dev --name phase4-automation-reporting`

## 2. Anomaly Detection Engine

- [ ] 2.1 Create `lib/anomaly-detector.ts` — evaluate invoices against configured thresholds
- [ ] 2.2 Implement hour deviation check: compare to worker's prior 3-month average
- [ ] 2.3 Implement amount ceiling check: flag if `totalAmount > config.amountCeiling`
- [ ] 2.4 Implement missing TD data check: TD_ONLY workers with no hours for the month
- [ ] 2.5 Write `AnomalyFlag` records for each detected anomaly with type and severity

## 3. Automation Orchestrator

- [ ] 3.1 Create `lib/automation-run.ts` — chains: TD sync → anomaly check → (gate) → Wise batch → Xero sync
- [ ] 3.2 Implement gate logic: if any HIGH severity anomalies exist, pause run and notify #finance
- [ ] 3.3 Create `AutomationRun` record per monthly run; update status at each step
- [ ] 3.4 Update existing TD cron (`/api/cron/td-sync`) to invoke orchestrator instead of sync-only
- [ ] 3.5 Post comprehensive Slack summary on run completion: invoices generated, amount, anomalies flagged, payment status

## 4. Admin Anomaly Review UI

- [ ] 4.1 Create `/admin/automation` page showing current month's run status and anomaly list
- [ ] 4.2 Anomaly table: worker, type, severity, details, "Mark Reviewed" action
- [ ] 4.3 "Resume Run" button — only enabled when all HIGH anomalies are reviewed
- [ ] 4.4 Resume calls `POST /api/admin/automation/[runId]/resume` → triggers Wise batch

## 5. Monthly Finance Report

- [ ] 5.1 Create `lib/report-generator.ts` — aggregate paid invoices for a month into report structure
- [ ] 5.2 Create `GET /api/admin/reports/[year]/[month]` endpoint
- [ ] 5.3 Create `GET /api/admin/reports/[year]/[month]/csv` for CSV export
- [ ] 5.4 Add report cron (`0 8 2 * *` UTC) in `vercel.json`
- [ ] 5.5 Create `/admin/reports` page — list of monthly reports with download links
- [ ] 5.6 Post Slack summary with report highlights on generation

## 6. Analytics Dashboard

- [ ] 6.1 Create `GET /api/admin/analytics` endpoint — returns 12-month aggregates from Invoice/PaymentRun tables
- [ ] 6.2 Create `/admin/analytics` page with payment volume chart (bar, 12 months)
- [ ] 6.3 Add worker headcount chart (paid workers per month)
- [ ] 6.4 Add currency breakdown chart (stacked bar by EUR/USD/crypto)

## 7. Config & QA

- [ ] 7.1 Create `/admin/settings/automation` page — anomaly thresholds config
- [ ] 7.2 Seed default `AutomationConfig` in migration
- [ ] 7.3 End-to-end QA: run full automation cycle against sandbox data, verify gate pauses, resume, report generation
