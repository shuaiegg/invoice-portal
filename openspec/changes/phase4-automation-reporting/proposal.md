## Why

Phases 1–3 build all the integration pieces. Phase 4 connects them into a fully automated monthly cycle and adds the visibility layer (reports, anomaly detection) so the finance team can trust the system and act only on exceptions rather than routine processing.

## What Changes

- **End-to-end monthly automation**: A single Cron run chains TD sync → invoice generation → Wise batch payment → Xero sync, with anomaly-only human intervention required
- **Monthly finance report**: Auto-generated on the 2nd of each month summarising total payments by currency, by team, and reconciliation status vs Xero
- **Anomaly detection**: Flag invoices where TD hours deviate >10% from prior month, amounts exceed configurable ceiling, or TD matching fails
- **Exception dashboard**: Admin view showing all anomalies requiring human review before the automated run proceeds to payment
- **Historical trends**: Dashboard charts showing payment volume, worker count, and currency breakdown over time

## Capabilities

### New Capabilities
- `monthly-automation-run`: Orchestrated monthly cron that chains all phases with configurable stop-points for human review
- `finance-report`: Auto-generated monthly PDF/CSV report: payments by currency, by team, Xero reconciliation diff
- `anomaly-detection`: Rules engine flagging amount outliers, match failures, and rate changes before payment
- `analytics-dashboard`: Historical payment trends — volume, headcount, currency mix over rolling 12 months

### Modified Capabilities
- `timedoctor-sync`: Sync now feeds directly into payment pipeline rather than stopping at invoice generation — run proceeds to Wise batch if no anomalies detected
- `wise-payment-batch`: Batch now triggered automatically by cron (not just manual admin action) when anomaly gate passes

## Impact

- **Database**: New `MonthlyReport`, `AnomalyFlag` models; `PaymentRun` gains `automationRunId`
- **APIs**: `GET /api/admin/reports/[year]/[month]`, `GET /api/admin/analytics`
- **Cron**: Existing `0 6 1 * *` cron extended to chain phases; new `0 8 2 * *` cron for report generation
- **Non-goals**: Real-time streaming analytics, worker-facing analytics, multi-company/tenant support, external BI tool integration
