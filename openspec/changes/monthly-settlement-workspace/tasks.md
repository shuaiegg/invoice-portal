# Tasks: Monthly Settlement Workspace

## 1. Data foundation (migration + billingMonth)

- [x] 1.1 Prisma migration: add `TdSyncRun.skippedExisting Int @default(0)`; in the same migration, backfill `Invoice."billingMonth" = to_char("invoiceDate", 'YYYY-MM')` where null; run `npx prisma generate`
- [x] 1.2 Inspect worker invoice create/edit routes (`app/api/invoices/...`) to determine the service-period source (explicit month field vs `serviceDate`/`period` text vs `invoiceDate` fallback) and write `billingMonth` on both paths
- [x] 1.3 Unit-test billingMonth derivation for the manual-submission edge case (July submission for June work → `2026-06`)

## 2. TD sync transparency

- [x] 2.1 `lib/td-sync.ts`: count `skippedExisting` in the existing-invoice branch, persist on the run record, include in the returned result and in `tdSyncSummary`
- [x] 2.2 `POST /api/admin/td-sync/run`: accept optional `{year, month}` (validate: complete past month within 24 months), default previous month
- [x] 2.3 `td-sync-panel.tsx`: month selector (last 12 months, default previous), toast reads "N created · M already existed", add Skipped-existing to last-run summary and run-history table (include `skippedExisting` in the status endpoint payload if absent)
- [x] 2.4 Extend `tests/` coverage for the sync counter (re-run over an already-synced month reports created=missing-only, skippedExisting=rest)

## 3. Payment channel derivation

- [x] 3.1 Create `lib/payment-channel.ts`: `deriveChannel(accounts)` per design D2 (WISE→Wise, PAYPAL→PayPal, else Manual; preferred first, single-account fallback) + display labels
- [x] 3.2 Unit tests: preferred wins, no-preferred single account, no accounts, CRYPTO/REVOLUT/BANK_TRANSFER/OTHER fold to Manual
- [x] 3.3 Server helper to resolve worker→channel maps and filter invoices by channel (shared by list page, export, bulk endpoints)

## 4. Admin invoice list — month + channel workspace

- [ ] 4.1 `app/(admin)/admin/invoices/page.tsx`: switch month filter, `availableMonths`, and monthly aggregates to `billingMonth`; group header totals by currency (render `€X + $Y` when mixed)
- [ ] 4.2 Add channel tabs (All/Wise/PayPal/Manual) with counts scoped to active month/status filters; `channel` URL param combines with existing filters
- [ ] 4.3 `admin-invoice-table.tsx`: add channel column; add `xero=failed` filter option (PAID + `xeroSynced=false`) in filters UI
- [ ] 4.4 `GET /api/admin/invoices/export`: filter by `billingMonth` + `channel` (+ existing filters); add channel and payout-account-detail columns (`formatPaymentAccountKeyDetail`)

## 5. Bulk operations API

- [ ] 5.1 Extend `POST /api/admin/invoices/bulk-status`: `action: "APPROVE" | "MARK_PAID"`, accept `invoiceIds` or `filter` object (server-resolved), per-row guarded transitions via `lib/invoice-status.ts`, response `{targeted, transitioned, skippedWrongStatus, xeroSynced, xeroFailed, failedInvoices}`
- [ ] 5.2 Add `dryRun: true` mode returning targeted count, per-currency totals, and `paymentIncomplete` workers (per design D4); execution accepts `excludeWorkerIds`
- [ ] 5.3 MARK_PAID path: await Xero syncs with bounded concurrency (~5), set `maxDuration`, report per-invoice outcomes (keep PAID-on-failure semantics)
- [ ] 5.4 New `POST /api/admin/invoices/retry-xero`: IDs or filter, re-sync without status change, same outcome summary shape
- [ ] 5.5 `lib/slack.ts`: `bulkOperationDigest(...)` (one message: action, count, per-currency totals, channel breakdown, xero failures); bulk route stops calling `invoiceStatusChanged` per invoice but keeps per-invoice `invoicePaidWorkerNotification` for MANUAL workers
- [ ] 5.6 Tests: filter-scoped resolution, mixed-status skip counting, dry-run pre-check flags missing Wise/PayPal email, concurrent-status-change race (guard skips, never corrupts)

## 6. Bulk operations UI

- [ ] 6.1 `admin-invoice-table.tsx`: "Select all N matching filters" banner when filtered total exceeds page; selection mode switches to filter-scoped
- [ ] 6.2 Bulk action bar: Approve button for SUBMITTED selections, Mark Paid for APPROVED, channel-scoped CSV export shortcut
- [ ] 6.3 Confirmation dialog rendering dry-run result: resolved count, per-currency totals, payment-incomplete worker list with "proceed excluding N" option
- [ ] 6.4 Result toast/panel: transitioned/skipped/xeroFailed breakdown with link to `xero=failed` filter; bulk retry action from that filtered view

## 7. Dashboard settlement card

- [ ] 7.1 `app/(admin)/admin/page.tsx`: settlement card for selectable `billingMonth` (default previous month, Europe/Paris) — status breakdown, per-currency totals, unresolved match failures, xero-failed count, link to pre-filtered invoice list
- [ ] 7.2 Derived completion indicator (all non-VOID PAID + no unresolved match failures) with progress display
- [ ] 7.3 Rebase/absorb the existing "Invoices This Month" and "Paid This Month" stats onto `billingMonth` so dashboard numbers match the invoice list

## 8. Verification

- [ ] 8.1 Run existing test suite + new tests; `npm run lint`; `npm run build`
- [ ] 8.2 End-to-end pass on dev: re-run TD sync for June (expect "1 created · 198 already existed" style report), filter June by channel, dry-run + bulk approve a small channel batch, bulk mark paid, confirm single Slack digest and xero-failed filter/retry path
