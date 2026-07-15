## Context

Time Doctor exposes a REST API (verified against the live spec at `api2.timedoctor.com/spec/*` on 2026-07-13). The correct endpoint for monthly totals is `GET /api/1.1/stats/total` (not `/api/1.0/timesheet/...` as originally assumed — that path doesn't exist). The portal must: authenticate, fetch previous month's data, match users to workers, and generate invoices atomically. All TD operations are read-only — the portal never writes to TD.

**Verified against the real API using the account in `.env.local`** (`TimeDoctor_Email` / `TimeDoctor_SECRET`, role `admin` on a 262-user company):
- Login (`POST /api/1.0/authorization/login`) returns a JWT valid ~6 months, plus `data.companies[]` (companyId source) — confirms the original assumption.
- `GET /api/1.0/users` returns the full company user list (all 262 users, with email) — confirms TD-to-worker email matching is feasible with this account.
- `GET /api/1.1/stats/total?company={id}&user=all&group-by=userId&fields=totalSec&from=...&to=...` returns per-user total tracked seconds for the whole company in one call — confirms the "one call per month" rate-limit mitigation works.
- **Correction (found via the official Redocly docs, not the internal `/spec/*` catalog used above — that catalog is stale/incomplete): a real Payroll API does exist.** `GET /api/1.0/users/payroll?company={id}` (list) and `PUT /api/1.0/users/{userId}/payroll` (update) both work against the live API. The record schema includes `payRate` (number), `payMethod` (string — observed value `"manual"`; docs list `"transferwise"` i.e. Wise and `"paypal"` as other valid values), `currency`, `adjustment`, `hourlyLimit`, `hourlyLimitRange`.
- **But this service account can only see its own payroll record.** `GET /api/1.0/users/payroll?company={id}` returned `paging.totalCount: 1` — just the API-connection account itself, not the other ~261 workers. `getUsersPayroll` has no `user=` filter param at all (unlike the stats endpoints); visibility is entirely governed by the company's `whoCanAccessPayroll` setting, currently `"owner"`. This service account's role is `admin`, so it's locked out of everyone else's payroll data — this is the exact restriction the user originally observed, and it applies at the API level too, not just the TD web UI.
- **Confirmed closed with TD support (2026-07-13): Payroll access cannot be read-only.** Asked TD support directly whether `whoCanAccessPayroll` could grant a scoped/read-only view for an API integration account. Their answer: no — "there is no read-only for Payroll. Once a profile is granted Payroll access, it will have comprehensive access to all aspects of the Payroll feature, including setup and configuration." Elevating the service account's permissions to read `payRate`/`payMethod` for all workers would also hand it full Payroll setup/configuration rights company-wide. That's a disproportionate blast radius for an automated sync job (a leaked/misused token could reconfigure company payroll, not just read hours) — not worth it for two fields we can perfectly well keep in Portal. **Decision: do not pursue API access to TD Payroll.**
- **TD is the actual source of truth for rate — not something Finance should hand-manage in Portal.** Annual raises are applied by each worker's manager directly in TD (per-worker, manual edit in TD's UI), not through any Portal-side process. So `Worker.hourlyRate` in Portal has to be treated as a periodically-refreshed mirror of TD, not an independently admin-typed value — otherwise a raise applied in TD silently goes stale in Portal with no way to detect the drift.
- **Found the export that solves this: TD's "Payroll summary" report.** Distinct from the three payment-method-specific exports (Manual/Wise/PayPal payout files, which don't all show rate — see below), TD has a combined report ("Payroll summary", exportable by date range from the same Payroll page) that lists **every** worker with `Hourly rate` and `Payment method` in one file, regardless of how they're paid. Verified against a real export (`docs/Payroll for 2026-07-01_2026-07-31/Payroll summary 2026-07-06_2026-07-12.csv`, gitignored — contains real employee pay data): 261 rows, 261 unique emails, zero missing/zero rates, `Total pay = Total hours × Hourly rate + Adjustment` checks out on every sampled row, `Payment method` is one of `Manual` (122) / `Wise` (101) / `PayPal` (38). This single report is the intended source for both `Worker.hourlyRate` and payment-method reconciliation — no need for the payment-method-specific exports, and no need to derive rate from `amount ÷ hours` for Wise/PayPal-paid workers (that approximation is no longer needed).
- **TD's `Manual` payment-method bucket doesn't map 1:1 to a Portal `PaymentAccountType`.** It just means "not paid through TD's Wise/PayPal integration" — could be bank transfer, crypto, anything. `Wise` → `PaymentAccountType.WISE` and `PayPal` → `PaymentAccountType.PAYPAL` are unambiguous; the `Manual` group (122 of 261 workers) needs a human (Finance) to confirm the actual rail per worker — cannot be inferred from this file alone.
- **Worker registration**: workers aren't in the Portal yet. Agreed direction — make `Worker.userId` nullable, pre-create `Worker` rows (with `hourlyRate`/payment info from the Payroll summary import) keyed by email with no linked `User`, and auto-claim on registration when a new `User.email` matches an unclaimed `Worker`. Invite delivery channel: Slack (not email — Portal has no email-sending integration configured anywhere; confirmed via grep, no Resend/SendGrid/Nodemailer in the codebase).

## State Machine

`InvoiceStatus` currently has no `DRAFT` value (`SUBMITTED, APPROVED, PAID, VOID` only) — adding it is required, not optional, since the `td_plus` path depends on it.

```
DRAFT ──worker submits──> SUBMITTED ──admin approves──> APPROVED ──admin marks paid (→ Xero sync)──> PAID
  │                            │
  └── VOID (admin, any time) ──┴── VOID (worker revoke, SUBMITTED only — existing behavior; admin VOID already unconditional from any status)
```

- `DRAFT` is `td_plus`-only, created by the sync (design.md Decisions). `td_only` invoices skip straight to `SUBMITTED`.
- Worker can edit line items while `DRAFT` or `SUBMITTED` — the existing edit route (`app/api/invoices/[id]/route.ts`) only allows `SUBMITTED` today and needs extending to include `DRAFT` (see tasks.md 3a.1).
- Admin's `VOID` transition (`app/api/admin/invoices/[id]/route.ts`) is already unconditional on current status, so it covers `DRAFT → VOID` with no code change once the enum value exists — worth a test case rather than assuming (tasks.md 3a.2).
- Xero sync is triggered only on `PAID` (existing behavior, confirmed in code) — this already means a `DRAFT`/`SUBMITTED`/`APPROVED` invoice, including a €0 `td_only` invoice for a zero-hours month, never touches Xero unless an admin deliberately marks it paid. No separate "push to Xero?" toggle needed for Phase 2.

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

**Admin connects via email/password login, not manual token entry — the token is opaque, not a JWT, and needs `Authorization: JWT`, not `Bearer`**
Verified twice against the live API (once during initial research, once during manual QA of the built feature) and both times the implementation had drifted from this: (1) TD's auth header scheme is `Authorization: JWT <token>`, not the more conventional `Bearer <token>` — using `Bearer` gets a 401 `invalidToken` even with a valid token. (2) The token itself has no dots (`token.split(".")` yields 1 part) — it is **not** a JWT despite looking like one, so decoding it to extract an `exp` claim always silently returns null. The real expiry comes from the login response's own top-level `data.expiresAt` field. `lib/timedoctor.ts::loginToTimeDoctor()` does the email+password exchange server-side (`POST /api/1.0/authorization/login`) and reads `data.token`, `data.companies[0].id`, `data.expiresAt` directly — this is now the primary way to connect (`/admin/settings/timedoctor`'s "Connect" button), with manual companyId+token paste kept only as a collapsed fallback for pasting a token obtained some other way. Neither the admin's TD email nor password is ever persisted — only the resulting token/companyId/expiry, matching the original "store the token, not credentials" rationale above.

**Use `GET /api/1.1/stats/total`, `totalSec` field, grouped by `userId`**
Lorena clarified "approved hours" simply means the total time Time Doctor tracked for the month — there is no separate approval workflow to account for. (TD's `approved` flag only exists on individually-edited manual time entries via `/activity/edit-time`, not as a whole-timesheet concept — that's a dead end.) `totalSec` from `/api/1.1/stats/total` is the correct field: it's the same aggregate TD's own UI shows as total tracked time. Call with `user=all&group-by=userId&fields=totalSec` to get all workers in one request.

**Hours in seconds → divide by 3600, round to 2 decimal places**
TD returns worked time in seconds (`totalSec`). Round to 2dp to avoid floating-point invoice amounts.

**`Worker.hourlyRate` is a mirror of TD, refreshed via periodic admin CSV import — not a value Finance types once and owns**
TD's Payroll API can't be read at scale without over-granting the service account (see Context), but TD is the real source of truth (managers apply raises there directly). Resolution: add `Worker.hourlyRate Float?`, and build an admin CSV import that consumes TD's "Payroll summary" export (`Name, Email, ..., Currency, Hourly rate, Total pay, Payment method`), matches rows to workers by email, and updates `hourlyRate` (and cross-checks payment method) on every import — subject to the conflict protection below. This is not a one-time backfill — cadence should follow the actual change cadence (raise cycles, new hires), re-imported whenever the admin exports a fresh file, not a fixed schedule. Sync should skip/flag (not crash) a matched TD_ONLY/TD_PLUS worker with no `hourlyRate` set, and surface it in the match-failure/review queue.

**Admin can also edit `hourlyRate` directly in Portal — protected against being silently clobbered by the next import**
For urgent one-off adjustments (a rate change needed before the next scheduled TD export/import), admin can edit `Worker.hourlyRate` straight from the worker edit screen rather than waiting on a full CSV cycle. Since the CSV import is the authoritative refresh mechanism, a naive re-import would otherwise blindly overwrite that manual edit and silently revert it — a real footgun if the corresponding TD-side update (the manager's actual raise entry) hasn't landed yet. Mitigation: track `Worker.hourlyRateSource` (`TD_IMPORT` | `MANUAL`) and `hourlyRateUpdatedAt`. A manual edit sets `source: MANUAL`. On the next import, a worker with `source: MANUAL` is **not** silently overwritten: if the imported rate matches the current value, TD has caught up — reset silently to `TD_IMPORT`; if it differs, raise a `WorkerRateConflict` for admin review (Portal value vs imported value, pick one) rather than picking automatically. Reuses the same review-queue pattern as `TdMatchFailure`, not a new UI concept.

**Payment method (Wise/PayPal/Manual) — reconciled from the same "Payroll summary" import, not typed independently**
The same CSV import that sets `hourlyRate` also carries TD's `Payment method` column (`Wise`/`PayPal`/`Manual`). `Wise`→`PaymentAccountType.WISE` and `PayPal`→`PaymentAccountType.PAYPAL` map directly; `Manual` (122 of 261 workers) is TD's catch-all for "not paid via TD's Wise/PayPal integration" and does **not** map to a specific Portal `PaymentAccountType` — those workers' actual rail (bank transfer / crypto / other) needs Finance confirmation per worker, the import should flag them for review rather than guessing.

**TD's payment method also drives `Worker.paymentType` (invoice automation level), not just `PaymentAccountType` (payment rail)**
These are two different fields answering two different questions — the import sets both from the same `Payment method` column: `Wise` → `paymentType: TD_ONLY` (preserves the pre-Portal workflow of uploading straight to Wise for automatic payment with no per-invoice review); `PayPal` and `Manual` both → `paymentType: TD_PLUS` (hours still pulled from TD automatically, but every invoice lands as a DRAFT pending review/submission — they differ from each other only in payment rail, not in automation level). Portal's `MANUAL` paymentType is intentionally never set by this import — it stays reserved for workers entirely outside TD, who self-report hours with no TD sync at all. See `lib/worker-import.ts::paymentTypeForTdMethod`.

**Worker pre-provisioning: nullable `Worker.userId`, claimed by email at registration, invited via Slack**
Workers don't exist as Portal users yet, and `Worker.userId` is currently required+unique (1:1 with `User`), so a `Worker` can't be created ahead of someone signing up — blocking both the rate import above and Phase 2 sync in general (`td_only`/`td_plus` invoices need a `Worker` row to attach to). Fix: make `Worker.userId String?` (nullable, still unique — Postgres allows multiple nulls). The Payroll-summary import (and/or TD user-list sync) pre-creates `Worker` rows with `userId: null` keyed by `timeDoctorEmail`. Add matching logic to `lib/auth.ts`'s `after:sign-up` hook: on new-user creation, look up an unclaimed `Worker` (`userId IS NULL`) by case-insensitive email match and link it (`userId = newUser.id`) instead of relying on the existing lazy-create-on-first-`/profile`-visit path. Invite notification goes out via Slack (no email-sending integration exists in the codebase today — confirmed via grep for Resend/SendGrid/Nodemailer, zero matches).

**Idempotency: check (workerId, billingMonth) before creating, backed by a DB unique constraint**
Application-level check (query before insert) plus a `@@unique([workerId, billingMonth])` constraint on `Invoice` — the query alone leaves a race window if a manual trigger overlaps the cron run; the DB constraint is what actually guarantees no duplicate, the query is just a friendlier pre-check.

**Sync runs asynchronously, cron returns 200 immediately**
Vercel serverless functions have a 10s limit for hobby plans (60s pro). With 200+ workers, the full sync may take longer. The cron endpoint enqueues the job and returns 200; processing happens in a background function or is chunked.

**DRAFT invoices for td_plus — worker has 48-hour window to add items**
After 48 hours, admin can manually advance DRAFT to SUBMITTED if the worker hasn't acted. This is a soft SLA, not enforced by the system automatically in Phase 2. An automated reminder ping before the 48h mark is deliberately deferred — not enough real usage data yet to know if it's needed (see Open Questions).

**Inactive Portal accounts are excluded from sync at the query level**
`active` lives on `User`, not `Worker`. Matching query filters `where: { user: { active: true } }` so deactivated workers are never invoiced, without needing a separate exclusion check. Report the exclusion count in the sync summary as its own bucket — distinct from `TdMatchFailure` (which means "needs manual linking", not "correctly excluded").

**Total sync failure gets a distinct, louder Slack alert than partial failure**
The routine per-run summary ("148 generated · 4 unmatched") already exists for partial failures. A *total* failure (TD auth/token error, the whole fetch throwing) is a different, worse case — it must not silently look like "0 invoices, 0 issues." Wrap the whole sync in a top-level try/catch separate from per-worker error handling, and fire a visually distinct alert ("🔴 TD sync failed to start — check /admin/settings/timedoctor") pointing at the likely fix.

**Lightweight audit trail via actor fields, not a generic AuditLog table**
`integration-design-requirements.md` requires recording actor/timestamp for anything touching this integration. Rather than a new generic audit subsystem (that's Phase 4 territory, and isn't planned there either), add targeted actor fields to the new models this change introduces: `Worker.hourlyRateUpdatedBy`, `WorkerRateConflict.resolvedBy`, `WorkerImportBatch.importedBy`, `TdSyncRun.triggeredBy`. A single `ADMIN` role is enough — knowing *which* admin acted is achieved by recording the actor per action, not by splitting roles into tiers.

**`Worker.currency` added alongside `hourlyRate`**
Manually-submitted invoices get currency from the worker's own form input at submission time; auto-generated `td_only`/`td_plus` invoices have no form, so there's nothing to read it from today. TD's "Payroll summary" export has a `Currency` column per worker (USD and EUR both observed) — sourced from the same CSV import as `hourlyRate`.

## Risks / Trade-offs

- **TD API rate limits (~40 req/sec)**: With 200 workers, a single batch call fetching per-user stats may hit limits. Mitigation: use `GET /api/1.1/stats/total?user=all&group-by=userId` (one call per month, returns all users) rather than per-user calls — verified this works against the live API.
- **Timezone edge case**: TD stores hours in UTC. Workers in UTC-5 (Colombia) whose last day of month extends past midnight UTC would have their final hours counted in the next month. Mitigation: use a 1-hour buffer — fetch data up to `last-day-of-month 23:00 UTC` to catch most cases; document known edge case.
- **Token expiry**: 6-month TD token. Mitigation: store expiry date in `TimeDoctorConfig`, show warning in admin panel 2 weeks before expiry.

## Migration Plan

1. Add `TimeDoctorConfig` model, migrate
2. Admin configures TD credentials via settings page
3. Run first sync manually from admin panel to validate matching before enabling cron
4. Enable Vercel Cron after manual validation confirms correct results

## Open Questions

- Should td_plus workers have a configurable deadline (e.g. 3 days) to submit DRAFT before it auto-advances?
- Who determines the actual `PaymentAccountType` (bank transfer / crypto / other) for the 122 workers TD just labels `Manual`? Needs a Finance pass before the first CSV import is treated as authoritative for payment routing (rate import can proceed independently — it doesn't block on this).
- What's the actual re-import cadence in practice — does Finance re-export "Payroll summary" and re-run the admin import every time a manager applies a raise in TD, or is there a lighter-weight trigger (e.g. worker self-flags "my rate looks wrong" and that prompts a re-import)? Not blocking to start, but affects how much drift risk we accept between imports.
