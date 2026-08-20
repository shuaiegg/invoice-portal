## Context

Phases 1–3 deliver all integration pieces independently. Phase 4 orchestrates them into a single automated monthly cycle and adds the visibility/safety layer. The key design challenge is building a reliable pipeline where human review is required only for exceptions, not routine processing.

## Goals / Non-Goals

**Goals:**
- Single cron run chains TD → invoices → anomaly gate; payment remains manual
- Anomalies pause the run and require explicit admin clearance before finance is notified to pay
- Monthly report generated automatically and surfaced in Slack and admin portal
- Historical analytics available without separate data warehouse

**Non-Goals:**
- Real-time streaming analytics or BI tool integration
- Worker-facing analytics or pay history export
- Multi-company tenancy
- Automated anomaly resolution (human must always clear anomalies)

## Decisions

**Anomaly gate as explicit pause point, not soft warning**
Payment MUST NOT proceed automatically past an anomaly. The gate is a hard stop: the cron records a `RUN_PAUSED` status and waits for admin clearance. This prioritises safety over full automation — the finance team can always choose to lower thresholds as trust in the system grows.

**Anomaly thresholds stored in DB config, not hardcoded**
`AutomationConfig` table with `hourDeviationThreshold` (default 20%) and `amountCeiling` (default €10,000). Admin can adjust without a redeploy.

**Analytics computed from existing Invoice/PaymentRun tables, no separate aggregation**
For 200 workers × 12 months = ~2,400 invoice rows. Aggregation queries are fast enough without materialisation. A future Phase could add monthly snapshot tables if query latency becomes an issue.

**Second cron for report (`0 8 2 * *` UTC)**
Report runs on the 2nd to give finance time to complete manual payments on the 1st before the report is generated.

## Risks / Trade-offs

- **Long-running cron**: The full chain (TD fetch + anomaly detection for 200 workers) may approach Vercel's serverless timeout. Mitigation: each step is a separate API call chained by the cron; if a step fails, the run records its state and admin can see the failure on `/admin/automation`.
- **Anomaly threshold tuning**: Initial thresholds may cause too many false positives, creating friction. Mitigation: start conservative (20% threshold) and provide admin UI to tune; log all flagged anomalies for the first 3 months to calibrate.

## Migration Plan

Phase 4 is implemented without Wise (Phase 3 deferred as of 2026-08-12). The automation orchestrator chains TD sync → anomaly detection → gate → Slack notification to finance for manual payment. Admin marks invoices PAID manually in the portal, which triggers Xero sync automatically. The Wise batch step (originally step 3 in the chain) is omitted and can be inserted later if Phase 3 is resumed. No new DB migrations beyond the `AutomationConfig`, `AnomalyFlag`, `AutomationRun`, and `MonthlyReport` models.

## Decisions (resolved 2026-08-12)

**Anomaly clearance: single admin**
One admin can review and dismiss all anomaly flags and resume the run. No maker-checker required — current setup has a single finance admin (Felipe).

**No timeout on paused runs**
A `RUN_PAUSED` run waits indefinitely for human clearance. Manual payment flow has no fixed schedule, so a deadline would create false urgency. Admin sees the paused state on `/admin/automation`.

**New workers skip hour deviation check**
Workers with fewer than 3 months of invoice history are excluded from the HOUR_DEVIATION check. Amount ceiling check still applies.

**Resume does not change invoice status or send Slack**
On resume, `AutomationRun` status moves to `COMPLETED`. No invoice status change (APPROVED remains APPROVED). No Slack message. Finance checks `/admin/automation` to know when the run is clear and pays manually.
