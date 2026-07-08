## Context

Phases 1–3 deliver all integration pieces independently. Phase 4 orchestrates them into a single automated monthly cycle and adds the visibility/safety layer. The key design challenge is building a reliable pipeline where human review is required only for exceptions, not routine processing.

## Goals / Non-Goals

**Goals:**
- Single cron run chains TD → invoices → anomaly gate → Wise payments
- Anomalies pause the run and require explicit admin clearance before payment proceeds
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
Report runs the day after payments so it captures the complete picture including any late Wise webhook confirmations.

## Risks / Trade-offs

- **Long-running cron**: The full chain (TD fetch + 200 transfers + Xero sync) may exceed Vercel's serverless timeout. Mitigation: each step is a separate API call chained by the cron; if a step fails, the run records its state and admin can resume from the failed step.
- **Anomaly threshold tuning**: Initial thresholds may cause too many false positives, creating friction. Mitigation: start conservative (20% threshold) and provide admin UI to tune; log all flagged anomalies for the first 3 months to calibrate.

## Migration Plan

Phase 4 requires Phases 1–3 to be fully deployed and validated. No new DB migrations beyond the `AutomationConfig` and `AnomalyFlag` models. Roll out after first successful end-to-end manual run of Phase 3.

## Open Questions

- Should anomaly clearance require two admins (maker-checker) or is one sufficient?
- What is the grace period after cron pause — how long can a run stay paused before it's considered failed and must be restarted?
