## 1. Database Schema

- [x] 1.1 Add `TimeDoctorConfig` model (id, apiToken, companyId, tokenExpiresAt, lastSyncAt, lastSyncStatus)
- [x] 1.2 Add `TdSyncRun` model (id, runAt, status, invoicesCreated, matchFailed, inactiveSkipped, totalAmount, errorLog, triggeredBy String? — null for cron, admin userId for manual trigger)
- [x] 1.3 Add `TdMatchFailure` model (id, syncRunId, tdUserId, tdEmail, tdName, resolved, resolvedAt)
- [x] 1.4 Add `Invoice.tdSyncRunId` nullable FK field
- [x] 1.5 Add `Invoice.billingMonth` field (YYYY-MM string, for idempotency check)
- [x] 1.6 Add `Worker.hourlyRate Float?` — mirrors TD's "Payroll summary" export (TD is the actual source of truth; managers apply raises there directly), refreshed via admin CSV import, not typed independently in Portal. Required for any worker with `paymentType` TD_ONLY/TD_PLUS.
- [x] 1.7 Make `Worker.userId String?` nullable (still `@unique`) — lets a `Worker` row exist before the person has registered a `User` account, needed for both the rate import below and TD sync in general.
- [x] 1.8 Add `Worker.hourlyRateSource` enum (`TD_IMPORT` / `MANUAL`, default `TD_IMPORT`), `Worker.hourlyRateUpdatedAt DateTime?`, and `Worker.hourlyRateUpdatedBy String?` (admin userId, null when set by CSV import) — tracks whether the current rate came from the last CSV import or an admin override, so imports don't silently clobber a manual change (see 1a.6), and who made the last manual change (audit trail — see design.md)
- [x] 1.9 Add `WorkerRateConflict` model (id, workerId, portalRate, importedRate, importBatchId FK, resolved, resolvedAt, resolvedBy String? admin userId, createdAt) — same shape/pattern as `TdMatchFailure`, for rate conflicts surfaced during CSV import
- [x] 1.10 Add `WorkerImportBatch` model (id, importedBy String admin userId, importedAt, filename, createdCount, updatedCount, conflictCount) — both the audit trail for CSV imports and the import-history list for admin (mirrors `TdSyncRun`'s role for the hours sync)
- [x] 1.11 Add `Worker.currency String?` — TD's "Payroll summary" export has a per-worker `Currency` column (USD/EUR seen); needed so `td_only`/`td_plus` auto-generated invoices know which currency to use (manually-submitted invoices get this from the worker's form input today, but auto-generated ones have no form). Set via the same CSV import as `hourlyRate`.
- [x] 1.12 Add `DRAFT` to the `InvoiceStatus` enum (`DRAFT, SUBMITTED, APPROVED, PAID, VOID`) — **currently missing entirely**; required for the `td_plus` flow (task 3.4) which creates invoices with status `DRAFT`. Without this the enum won't accept the value and invoice creation will fail.
- [x] 1.13 Run `npx prisma migrate dev --name phase2-timedoctor-integration`

## 1a. Worker Pre-Provisioning, Rate Import & Registration Claim

- [x] 1a.1 Create `POST /api/admin/workers/import` — parses TD's "Payroll summary" CSV (`Name, Email, ..., Currency, Hourly rate, ..., Payment method`), upserts `Worker` by `timeDoctorEmail`, creates one `WorkerImportBatch` record per run (`importedBy` = calling admin's userId). Map `Payment method`: `Wise`→`PaymentAccountType.WISE`, `PayPal`→`PaymentAccountType.PAYPAL`, `Manual`→flag for Finance review (no auto-mapping — see design.md). Also sets `Worker.paymentType` from the same column: `Wise`→`TD_ONLY`, `PayPal`/`Manual`→`TD_PLUS` (see `lib/worker-import.ts::paymentTypeForTdMethod` and design.md) — applied on both create and update, every import run.
- [x] 1a.2 Import upsert logic per row: no existing `Worker` → create with `userId: null`, `hourlyRate` + `currency` from CSV, `hourlyRateSource: TD_IMPORT`. Existing `Worker` with `hourlyRateSource: TD_IMPORT` → overwrite `hourlyRate`/`currency` directly, refresh `hourlyRateUpdatedAt` (leave `hourlyRateUpdatedBy` null — import-sourced, not admin-sourced). Existing `Worker` with `hourlyRateSource: MANUAL`: if CSV rate equals current `hourlyRate`, silently reset `hourlyRateSource` back to `TD_IMPORT` (TD caught up, no conflict); if it differs, do **not** overwrite — create a `WorkerRateConflict` row instead (linked to the batch) and leave `Worker.hourlyRate` untouched
- [x] 1a.3 Admin worker edit screen: `hourlyRate` becomes directly editable; on change, set `hourlyRateSource: MANUAL`, `hourlyRateUpdatedAt: now()`, `hourlyRateUpdatedBy: <acting admin's userId>`
- [x] 1a.4 Admin rate-conflict review queue (reuse the `TdMatchFailure` review-queue UI pattern): list unresolved `WorkerRateConflict` rows, show Portal value vs imported value, "Keep Portal value" / "Use imported value" actions — the latter applies `portalRate = importedRate`, `hourlyRateSource: TD_IMPORT`, marks resolved with `resolvedBy: <acting admin's userId>`
- [x] 1a.5 Update `lib/auth.ts` `after:sign-up` hook: on new `User` creation, look up an unclaimed `Worker` (`userId IS NULL`) by case-insensitive email match against `timeDoctorEmail`; if found, link (`userId = newUser.id`) instead of leaving it to the existing lazy-create-on-`/profile`-visit path
- [x] 1a.6 Admin workers list: show claimed vs unclaimed (pending registration) status
- [x] 1a.7 Add `tdWorkerInvite(worker)` to `lib/slack.ts` — Slack notification inviting a pre-provisioned worker to register (channel/DM TBD)
- [x] 1a.8 Wire invite send into the import flow (1a.1) for newly-created pending workers
- [x] 1a.9 Set `Worker.team` from TD's tags, not the CSV (Payroll summary export has no team/department column). Added `lib/timedoctor.ts::fetchTeamsByEmail` — calls `GET /api/1.0/companies/{id}` (for `allUsersTagId`, the company-wide catch-all tag), `GET /api/1.0/tags`, and `GET /api/1.0/users`, resolves each email to whichever non-catch-all tag it has. Called once per import run, outside the DB transaction; best-effort — a failed/unreachable TD lookup logs a warning and the import proceeds without team data rather than failing outright.
- [x] 1a.10 Admin worker list: "Payment Type" column now displays `Worker.paymentMethod` (raw TD value: Wise/PayPal/Manual) instead of `Worker.paymentType` (TD_ONLY/TD_PLUS/MANUAL) — Finance needs to recognize payment rail at a glance, not the invoice-automation enum. Added a payment-method filter dropdown next to the search box, backed by a `paymentMethod` URL param / `Worker.paymentMethod` equality filter.
- [x] 1a.9 Admin import history view: list past `WorkerImportBatch` runs (who/when/counts), same list-pattern as the sync run history table (task 6.4)

## 2. Time Doctor API Client

- [x] 2.1 Create `lib/timedoctor.ts` — auth function (JWT token from stored credentials)
- [x] 2.2 Implement `fetchMonthlyHours(year, month)` using `GET /api/1.1/stats/total?user=all&group-by=userId&fields=totalSec` (verified endpoint — see design.md)
- [x] 2.3 Implement worker matching logic: query only `Worker`s with `user: { active: true }` (excludes deactivated Portal accounts at the DB level — `active` lives on `User`, not `Worker`), matched by `timeDoctorEmail` first, fallback to `email`, case-insensitive
- [x] 2.4 Implement hours conversion: seconds → hours (÷3600, rounded to 2dp)
- [x] 2.5 Add token expiry check: warn if token expires within 14 days

## 3. Sync Orchestration

- [x] 3.1 Create `lib/td-sync.ts` — main sync function: fetch hours → match workers → generate invoices. Wrap the whole run in a top-level try/catch distinct from per-worker error handling (see 3.8) — a total failure (e.g. TD auth/token error) must not look like "0 invoices, 0 failures" in the summary.
- [x] 3.2 Implement idempotency check: skip if invoice exists for (workerId, billingMonth). Backed by a DB-level `@@unique([workerId, billingMonth])` constraint on `Invoice` (not just an application-level query) — closes the race window between an overlapping manual trigger and the cron run.
- [x] 3.3 Implement `td_only` path: create `SUBMITTED` invoice with one TD line item, using `Worker.currency` (task 1.11). Zero-hours workers still get an invoice (€0) for record consistency — no special-casing needed: Xero sync already only fires on the `PAID` transition (existing code, `app/api/admin/invoices/[id]/route.ts`), so a €0 invoice never reaches Xero unless someone deliberately marks it paid.
- [x] 3.4 Implement `td_plus` path: create `DRAFT` invoice (requires 1.12) with TD line item pre-filled, using `Worker.currency`
- [x] 3.5 Implement match failure recording: create `TdMatchFailure` record for unmatched TD users. Keep this bucket distinct from workers skipped for being inactive (2.3) — report both counts separately in the run summary (3.6/3.7), don't conflate "needs manual linking" with "correctly excluded"
- [x] 3.6 Create `TdSyncRun` record on start (`triggeredBy`: null for cron, admin userId for manual — see 1.2); update with results on completion, including `inactiveSkipped` count
- [x] 3.7 Send Slack #finance summary on sync completion: "X invoices generated · €Y total · Z unmatched · W inactive skipped"
- [x] 3.8 Send a distinct, more prominent Slack alert on total sync failure (the top-level catch from 3.1) — e.g. "🔴 TD sync failed to start this month — check /admin/settings/timedoctor, TD token may need reconnecting." Must be visually/textually distinguishable from the routine partial-success summary (3.7), since a silent complete-failure is worse than a few unmatched workers.

## 3a. Existing Code Adjustments (required by DRAFT status)

- [x] 3a.1 `app/api/invoices/[id]/route.ts` (worker-facing edit route): currently hardcoded to `if (invoice.status !== "SUBMITTED") return "Only submitted invoices can be edited"`. Extend to allow `DRAFT` too (`!["SUBMITTED", "DRAFT"].includes(status)`), both in the initial check and the in-transaction re-check — otherwise `td_plus` workers can't add adjustment lines to their auto-generated draft.
- [x] 3a.2 Confirm (no code change expected): `app/api/admin/invoices/[id]/route.ts`'s `VOID` transition is already unconditional (`if (status === "VOID") isValid = true`), so `DRAFT → VOID` works automatically once 1.12 lands — verify with a test case rather than assuming.

## 4. API Endpoints

- [x] 4.1 Create `GET /api/cron/td-sync` — Vercel Cron endpoint, protected by CRON_SECRET, triggers sync
- [x] 4.2 Create `POST /api/admin/td-sync/run` — manual trigger from admin panel (admin only)
- [x] 4.3 Create `GET /api/admin/td-sync/status` — returns last sync run results and match failures
- [x] 4.4 Create `PUT /api/admin/td-sync/failures/[id]/resolve` — link unmatched TD user to worker

## 5. Admin Settings

- [x] 5.1 Create TD settings page `/admin/settings/timedoctor`
- [x] 5.2 Form: API token input, save → test connection → store in `TimeDoctorConfig`
- [x] 5.3 Show token expiry date and warning if < 14 days
- [x] 5.4 Add `POST /api/admin/settings/timedoctor/connect` + primary "Connect" UI: admin enters the TD integration account's email/password once, server exchanges it for a token via `loginToTimeDoctor()` and stores the result — no manual curl, no copy-pasting a token. Manual token paste kept as a collapsed fallback. Fixed two real bugs found via live API testing during this: auth header must be `JWT`, not `Bearer`; TD's token isn't a JWT, so expiry must come from the login response's `expiresAt` field, not decoded from the token.

## 6. Admin Sync Dashboard

- [x] 6.1 Add TD Sync panel to `/admin` dashboard: last run stats, match failure count, inactive-skipped count, triggered-by (cron vs admin name)
- [x] 6.2 "Run Sync Now" button with loading state and results display
- [x] 6.3 Match failure review queue: list unmatched TD users, worker picker dropdown, resolve action
- [x] 6.4 Sync run history table (last 12 runs)
- [x] 6.5 Rate-conflict review queue UI (see 1a.4) and import history view (see 1a.9) — can live on the same dashboard page as the TD sync panel, or its own `/admin/workers/import` page; admin's call on layout

## 7. Worker Notifications

- [x] 7.1 Add `tdPlusDraftReady(invoice, worker)` notification to `lib/slack.ts`
- [x] 7.2 Wire notification into `td_plus` invoice creation path in sync orchestration

## 8. Vercel Cron Configuration

- [x] 8.1 Add cron schedule to `vercel.json`: `{"crons": [{"path": "/api/cron/td-sync", "schedule": "0 6 1 * *"}]}`
- [x] 8.2 Add `CRON_SECRET` and `TD_API_TOKEN`, `TD_COMPANY_ID` to environment variables documentation
- [ ] 8.3 Manual QA: run sync against sandbox/test TD account, verify invoice generation and match failures
