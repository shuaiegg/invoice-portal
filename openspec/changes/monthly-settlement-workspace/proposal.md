# Monthly Settlement Workspace

## Why

Finance settles ~200 contractor invoices once a month (e.g. early August for July work), but the admin portal has no month-centric workflow: the TD sync reports misleading counts ("1 invoice generated" when 198 were idempotently skipped), the dashboard's "This Month" stats miss last month's billing invoices, month filtering uses `invoiceDate` instead of `billingMonth`, bulk actions are limited to one 20-row page with no bulk Approve, invoices can't be grouped by payout channel (Wise / PayPal / Manual) even though payments are executed per channel, and multi-currency totals are summed as if everything were EUR — a financially incorrect number.

## What Changes

- **TD sync transparency**: sync counts and reports `skippedExisting` (workers already invoiced for the month); the sync panel toast and run history show "N created · M already existed". Manual "Run Sync Now" gains a target-month selector (defaults to previous month).
- **billingMonth as the single month dimension**: the admin invoice month filter, monthly aggregates, and CSV export filter on `Invoice.billingMonth` (not `invoiceDate`); worker-submitted invoices populate `billingMonth` on create/edit so they appear in the correct settlement month.
- **Monthly settlement card on the admin dashboard**: a derived (no new tables) per-month overview — invoice count, per-currency totals, status breakdown (DRAFT/SUBMITTED/APPROVED/PAID), unresolved match failures, Xero sync failures, and a settlement progress indicator ("complete" = all non-VOID invoices PAID and no unresolved match failures) — linking into the month's invoice list.
- **Payment channel grouping**: each invoice's payout channel is derived live from its worker's preferred `PaymentAccount` (WISE → Wise, PAYPAL → PayPal, everything else including BANK_TRANSFER/CRYPTO/REVOLUT/OTHER/none → Manual); the invoice list gets channel tabs with counts and a channel column; CSV export respects the channel filter.
- **Bulk operations, filter-scoped**: bulk Approve (SUBMITTED → APPROVED) added alongside bulk Mark Paid (APPROVED → PAID); "select all N matching current filter" executes server-side against the filter (month + channel + status + worker name), not a page-bound ID list.
- **Payment-info pre-check on bulk Approve**: before approving, workers missing usable payment details for their channel are surfaced; admin can proceed excluding them.
- **Bulk Xero failure visibility**: bulk Mark Paid returns a per-invoice outcome summary ("195 synced · 5 Xero failed"); a "Xero sync failed" filter and a bulk retry action are added. (Bulk keeps the existing semantics — invoices stay PAID on Xero failure — but failures become visible and retryable instead of silent.)
- **Aggregated Slack notifications for bulk actions**: one digest message per bulk operation (count, per-currency totals, channel breakdown) instead of one message per invoice. Per-invoice worker payment notifications (MANUAL paymentType) are preserved.

### Non-goals

- No Wise API payment execution (that is `phase3-wise-integration`; channel tabs only prepare the entry point).
- No changes to Xero sync mechanics or the single-invoice PAID revert-on-failure behavior.
- No changes to Time Doctor matching rules, cron schedule, or invoice generation math.
- No explicit "close month" state or lock — settlement completion is purely derived.
- No n8n involvement; Slack stays direct-webhook, notification-only.
- No new database tables; `billingMonth` and `PaymentAccount` already exist (only backfill/write-path fixes).

### Touches

Invoices (admin list/filters/bulk APIs, worker submit write-path), payments (channel derivation, read-only), Xero (retry entry point only, no sync-logic change), Time Doctor (sync counters + month parameter), Slack (aggregation), permissions unchanged (all behind existing `requireAdmin`). Wise/n8n untouched.

## Capabilities

### New Capabilities

- `monthly-settlement`: month-centric admin views — billingMonth filtering everywhere, dashboard settlement card with derived progress, per-currency monthly totals.
- `bulk-invoice-operations`: filter-scoped bulk Approve / Mark Paid, payment-info pre-check, per-invoice Xero outcome reporting with retry, aggregated Slack digests.
- `payment-channel-grouping`: live channel derivation from preferred payment accounts, channel tabs/filter/column on the admin invoice list, channel-aware CSV export.

### Modified Capabilities

- `timedoctor-sync`: sync run reporting gains a `skippedExisting` counter and the manual trigger gains a target-month parameter. (Baseline spec lives in `openspec/changes/phase2-timedoctor-integration/specs/timedoctor-sync/` — not yet synced to main specs; this change carries a delta spec.)

## Impact

- **DB**: no schema change expected; `Invoice.billingMonth` backfill for existing worker-submitted rows (derive from `invoiceDate`), new `skippedExisting` column on `TdSyncRun` (single additive migration).
- **API routes**: `POST /api/admin/td-sync/run` (month param), `POST /api/admin/invoices/bulk-status` (approve support, filter-scoped selection, outcome reporting), `GET /api/admin/invoices/export` (billingMonth + channel filters), new bulk Xero retry endpoint.
- **Lib**: `lib/td-sync.ts` (counter), `lib/slack.ts` (digest helpers), new `lib/payment-channel.ts` (derivation), `lib/invoice-status.ts` reused for bulk transition guards.
- **UI**: `app/(admin)/admin/page.tsx` (settlement card replaces misaligned "This Month" stats), `app/(admin)/admin/invoices/page.tsx` + `invoice-filters.tsx` + `admin-invoice-table.tsx` (tabs, channel column, filter-scoped bulk bar), `td-sync-panel.tsx` (month selector, skipped count).
- **Dependencies**: none added.
