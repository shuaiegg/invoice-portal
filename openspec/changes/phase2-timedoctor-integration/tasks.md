## 1. Database Schema

- [ ] 1.1 Add `TimeDoctorConfig` model (id, apiToken, companyId, tokenExpiresAt, lastSyncAt, lastSyncStatus)
- [ ] 1.2 Add `TdSyncRun` model (id, runAt, status, invoicesCreated, matchFailed, totalAmount, errorLog)
- [ ] 1.3 Add `TdMatchFailure` model (id, syncRunId, tdUserId, tdEmail, tdName, resolved, resolvedAt)
- [ ] 1.4 Add `Invoice.tdSyncRunId` nullable FK field
- [ ] 1.5 Add `Invoice.billingMonth` field (YYYY-MM string, for idempotency check)
- [ ] 1.6 Run `npx prisma migrate dev --name phase2-timedoctor-integration`

## 2. Time Doctor API Client

- [ ] 2.1 Create `lib/timedoctor.ts` — auth function (JWT token from stored credentials)
- [ ] 2.2 Implement `fetchMonthlyHours(year, month)` using approved timesheet endpoint
- [ ] 2.3 Implement worker matching logic: `timeDoctorEmail` first, fallback to `email`, case-insensitive
- [ ] 2.4 Implement hours conversion: seconds → hours (÷3600, rounded to 2dp)
- [ ] 2.5 Add token expiry check: warn if token expires within 14 days

## 3. Sync Orchestration

- [ ] 3.1 Create `lib/td-sync.ts` — main sync function: fetch hours → match workers → generate invoices
- [ ] 3.2 Implement idempotency check: skip if invoice exists for (workerId, billingMonth)
- [ ] 3.3 Implement `td_only` path: create `SUBMITTED` invoice with one TD line item
- [ ] 3.4 Implement `td_plus` path: create `DRAFT` invoice with TD line item pre-filled
- [ ] 3.5 Implement match failure recording: create `TdMatchFailure` record for unmatched TD users
- [ ] 3.6 Create `TdSyncRun` record on start; update with results on completion
- [ ] 3.7 Send Slack #finance summary on sync completion: "X invoices generated · €Y total · Z unmatched"

## 4. API Endpoints

- [ ] 4.1 Create `GET /api/cron/td-sync` — Vercel Cron endpoint, protected by CRON_SECRET, triggers sync
- [ ] 4.2 Create `POST /api/admin/td-sync/run` — manual trigger from admin panel (admin only)
- [ ] 4.3 Create `GET /api/admin/td-sync/status` — returns last sync run results and match failures
- [ ] 4.4 Create `PUT /api/admin/td-sync/failures/[id]/resolve` — link unmatched TD user to worker

## 5. Admin Settings

- [ ] 5.1 Create TD settings page `/admin/settings/timedoctor`
- [ ] 5.2 Form: API token input, save → test connection → store in `TimeDoctorConfig`
- [ ] 5.3 Show token expiry date and warning if < 14 days

## 6. Admin Sync Dashboard

- [ ] 6.1 Add TD Sync panel to `/admin` dashboard: last run stats, match failure count
- [ ] 6.2 "Run Sync Now" button with loading state and results display
- [ ] 6.3 Match failure review queue: list unmatched TD users, worker picker dropdown, resolve action
- [ ] 6.4 Sync run history table (last 12 runs)

## 7. Worker Notifications

- [ ] 7.1 Add `tdPlusDraftReady(invoice, worker)` notification to `lib/slack.ts`
- [ ] 7.2 Wire notification into `td_plus` invoice creation path in sync orchestration

## 8. Vercel Cron Configuration

- [ ] 8.1 Add cron schedule to `vercel.json`: `{"crons": [{"path": "/api/cron/td-sync", "schedule": "0 6 1 * *"}]}`
- [ ] 8.2 Add `CRON_SECRET` and `TD_API_TOKEN`, `TD_COMPANY_ID` to environment variables documentation
- [ ] 8.3 Manual QA: run sync against sandbox/test TD account, verify invoice generation and match failures
