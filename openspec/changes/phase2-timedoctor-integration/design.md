## Context

Time Doctor exposes a REST API (`/api/1.0/activity/worklog`) returning worked seconds per user per period. The portal must: authenticate, fetch previous month's data, match users to workers, and generate invoices atomically. All TD operations are read-only — the portal never writes to TD.

TD API tokens are valid for 6 months. CompanyId is obtained from the TD login response and stored in `TimeDoctorConfig`.

## Goals / Non-Goals

**Goals:**
- Reliable monthly sync with idempotency (re-running never creates duplicate invoices)
- Clear admin visibility into match failures with resolution workflow
- Graceful degradation: partial failures do not abort the entire run

**Non-Goals:**
- Real-time TD sync or webhook-driven updates (TD has no webhooks)
- Writing to TD (no rate updates, no user management)
- Syncing tasks/projects breakdown (only total hours per user per month)
- Automatic retry on transient TD API failures (manual re-trigger is sufficient)

## Decisions

**Store TD credentials in DB (TimeDoctorConfig), not env vars**
Allows admin to update token via UI without a redeploy. Token is stored encrypted at rest (or as plaintext with the understanding that DB access is secured). Single record per company.

**Use `/api/1.0/timesheet/` approved hours, not raw worklog**
Lorena confirmed approved hours are the correct basis for payroll. Raw worklog includes unapproved time. This matches what TD's own payroll export uses.

**Hours in seconds → divide by 3600, round to 2 decimal places**
TD returns worked time in seconds. Round to 2dp to avoid floating-point invoice amounts.

**Idempotency: check (workerId, billingMonth) before creating**
Before generating, query for existing `Invoice` with matching `workerId` and `billingMonth`. If found (any status), skip. This makes re-runs safe.

**Sync runs asynchronously, cron returns 200 immediately**
Vercel serverless functions have a 10s limit for hobby plans (60s pro). With 200+ workers, the full sync may take longer. The cron endpoint enqueues the job and returns 200; processing happens in a background function or is chunked.

**DRAFT invoices for td_plus — worker has 48-hour window to add items**
After 48 hours, admin can manually advance DRAFT to SUBMITTED if the worker hasn't acted. This is a soft SLA, not enforced by the system automatically in Phase 2.

## Risks / Trade-offs

- **TD API rate limits (~40 req/sec)**: With 200 workers, a single batch call fetching per-user stats may hit limits. Mitigation: use the company-level worklog endpoint (one call per month, returns all users) rather than per-user calls.
- **Timezone edge case**: TD stores hours in UTC. Workers in UTC-5 (Colombia) whose last day of month extends past midnight UTC would have their final hours counted in the next month. Mitigation: use a 1-hour buffer — fetch data up to `last-day-of-month 23:00 UTC` to catch most cases; document known edge case.
- **Token expiry**: 6-month TD token. Mitigation: store expiry date in `TimeDoctorConfig`, show warning in admin panel 2 weeks before expiry.

## Migration Plan

1. Add `TimeDoctorConfig` model, migrate
2. Admin configures TD credentials via settings page
3. Run first sync manually from admin panel to validate matching before enabling cron
4. Enable Vercel Cron after manual validation confirms correct results

## Open Questions

- Should td_plus workers have a configurable deadline (e.g. 3 days) to submit DRAFT before it auto-advances?
- Which TD endpoint gives approved hours most reliably — `/timesheet/stats/1.1/total` or `/activity/worklog`? Confirm with Lorena/TD admin before implementation.
