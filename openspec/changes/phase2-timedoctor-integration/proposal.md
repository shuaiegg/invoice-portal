## Why

Manual invoice collection is the single biggest time drain for the finance team — Lorena spends hours each month chasing workers to submit invoices, cross-checking Time Doctor hours, and maintaining a spreadsheet. Phase 2 eliminates this by auto-generating invoices from Time Doctor on the 1st of each month, using the worker classification introduced in Phase 1.

## What Changes

- **TimeDoctorConfig model**: New DB table storing TD API token, companyId, and last-sync metadata
- **Vercel Cron job** (`0 6 1 * *` UTC): Monthly trigger that pulls TD worklog data and generates invoices
- **TD worker matching**: Match TD users to Portal workers by `timeDoctorEmail` (or fallback to login email); unmatched workers go to Admin review queue
- **Invoice auto-generation**:
  - `td_only` workers → invoice auto-created with status `SUBMITTED` (no worker action needed)
  - `td_plus` workers → invoice auto-created with status `DRAFT` with TD hours pre-filled; worker is notified to add adjustments and submit
- **Admin sync dashboard**: Shows last sync results — matched count, failed count, total amount, and review queue for failed matches
- **Sync result notifications**: Slack message to #finance summarising each monthly run
- **Worker pre-provisioning**: Admin imports TD's "Payroll summary" CSV to pre-create `Worker` rows (with `hourlyRate` + payment method) for the ~261 workers not yet registered on the Portal; workers are invited via Slack and claim their pre-created profile on registration by matching email

## Capabilities

### New Capabilities
- `timedoctor-sync`: Scheduled pull of Time Doctor worklog data, worker matching, and invoice auto-generation
- `sync-admin-dashboard`: Admin UI panel showing sync run history, match failures, and review queue
- `worker-preprovisioning`: Admin CSV import of TD payroll data to pre-create unclaimed `Worker` rows, Slack invite, and registration-time claim by email

### Modified Capabilities
- `worker-payment-profile`: `timeDoctorEmail` field (added in Phase 1) is now actively used for TD matching logic — no spec change needed, already defined
- `invoice-notifications`: New notification event: `td_plus` worker notified when draft invoice is ready for their review

## Impact

- **Database**: New `TimeDoctorConfig`, `WorkerRateConflict`, `WorkerImportBatch` models; `Invoice` gains `tdSyncRunId` (FK), `billingMonth`, and a `@@unique([workerId, billingMonth])` constraint; `InvoiceStatus` gains `DRAFT` (currently missing from the enum — required for `td_plus`); `Worker` gains `hourlyRate`, `hourlyRateSource`, `hourlyRateUpdatedAt`, `hourlyRateUpdatedBy`, `currency`; `Worker.userId` becomes nullable to support pre-provisioning ahead of registration; `TdSyncRun` gains `triggeredBy`
- **APIs**: New `POST /api/admin/td-sync` (manual trigger); new `GET /api/admin/td-sync/status`; new `GET /api/cron/td-sync` (Vercel Cron, protected by `CRON_SECRET`); new `POST /api/admin/workers/import` (Payroll summary CSV import)
- **Existing code**: `app/api/invoices/[id]/route.ts`'s edit-window check (currently `SUBMITTED`-only) extends to include `DRAFT`
- **Environment variables**: `TD_API_TOKEN`, `TD_COMPANY_ID`, `CRON_SECRET`
- **Non-goals**: No Wise payment initiation, no Xero changes, no TD write operations (read-only), no real-time TD webhook (polling only), no automated TD payroll API access (ruled out — see design.md)
