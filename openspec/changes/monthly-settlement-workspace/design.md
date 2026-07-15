# Design: Monthly Settlement Workspace

## Context

Finance settles ~200 TD-generated invoices per month. The pipeline (TD sync → review → approve → pay → Xero) works mechanically but the admin UX has no month-centric shape:

- `lib/td-sync.ts` skips already-invoiced workers silently — a re-run reports "1 invoice generated" after a 198-invoice run the day before, which reads as a failure.
- `POST /api/admin/td-sync/run` hardcodes the previous month.
- `app/(admin)/admin/invoices/page.tsx` filters months by `invoiceDate` range while TD writes a dedicated `Invoice.billingMonth` (`YYYY-MM`); worker-submitted invoices don't set `billingMonth` at all.
- `app/(admin)/admin/page.tsx` stats use `invoiceDate >= first day of current month`, so in July the 198 June invoices (invoiceDate = June 30) count as zero.
- `admin-invoice-table.tsx` bulk selection is page-bound (20 rows) and only supports Mark Paid; there is no bulk Approve.
- `bulk-status/route.ts` fire-and-forgets Xero sync (log-only) and sends one Slack message per invoice.
- Monthly totals do `SUM(totalAmount)` across currencies and render as EUR.
- Payout channel (Wise/PayPal/Manual) exists only implicitly via `PaymentAccount.type` + `isPreferred`; the invoice list can't group by it, though payments are executed per channel.

Constraints: no n8n involvement in state changes; Xero sync stays direct and unchanged mechanically; `phase3-wise-integration` will later attach Wise API execution to the Wise channel — this change must not preempt its decisions.

## Goals / Non-Goals

**Goals:**
- Make the monthly settlement flow legible end-to-end: sync → month workspace → channel batches → bulk approve/pay → derived completion.
- Make every bulk/sync operation report what actually happened (created/skipped/failed).
- Correct the two data-semantics defects: month = `billingMonth`, money grouped by currency.

**Non-Goals:**
- Wise API payment execution (phase3), Xero sync mechanics, TD matching rules, cron schedule.
- Stored month state, month locking, or a "close month" action — completion is derived only.
- New tables. Migration is additive: one `TdSyncRun.skippedExisting` column + `billingMonth` backfill.

## Decisions

### D1 — Month dimension: `billingMonth` string, backfilled, written on every create path
Filter, aggregate, and export on `Invoice.billingMonth` (`YYYY-MM` string equality; index if needed) instead of `invoiceDate` ranges.
- Worker submit/edit routes derive `billingMonth` from the invoice's service period (falling back to `invoiceDate`'s UTC `YYYY-MM`), so manual invoices land in the right settlement month even when submitted the following month.
- One-off backfill for existing null rows: `to_char("invoiceDate", 'YYYY-MM')`.
- *Alternative rejected*: keep `invoiceDate` ranges — wrong for manual invoices submitted after month end, and duplicates a field that already exists for exactly this purpose.

### D2 — Payout channel: derived at read time, never stored
`lib/payment-channel.ts` exposes `deriveChannel(accounts): "WISE" | "PAYPAL" | "MANUAL"`:
preferred account type WISE → Wise; PAYPAL → PayPal; anything else (BANK_TRANSFER, CRYPTO, REVOLUT, OTHER, none) → Manual; no preferred → fall back to the single account if exactly one exists, else Manual.
- Derived-live means a worker switching preferred account moves their unpaid invoices to the right tab automatically — which is correct, because payment execution uses the current account anyway.
- Channel filtering happens in SQL via the worker's payment accounts relation (a `Worker → PaymentAccount` join with the same preference logic expressed as a Prisma filter, or by computing worker→channel once per request and filtering invoices by workerId set — the latter is simpler and fine at 200-worker scale; choose during implementation).
- *Alternative rejected*: snapshot channel on the invoice — creates stale channels when accounts change between generation and payment, and requires backfill + write-path hooks for no benefit until phase3 (which can snapshot *at payment time* if it needs an audit trail).

### D3 — Filter-scoped bulk operations: server resolves the target set from filters
Extend `POST /api/admin/invoices/bulk-status` to accept either `invoiceIds` (existing, page-level) or a `filter` object (`billingMonth`, `channel`, `status[]`, `workerName`) plus `action: "APPROVE" | "MARK_PAID"`. The server re-resolves the filter to invoice IDs inside the request, applies the status guard from `lib/invoice-status.ts` per invoice, and processes with `updateMany`-per-transition semantics (only rows still in the expected source status transition — same guard style as today).
- Response shape: `{ targeted, transitioned, skippedWrongStatus, xeroSynced, xeroFailed, failedInvoices: [{id, invoiceNumber, reason}] }`.
- UI: keep per-row checkboxes for the current page; when the filtered total exceeds the page, show "Select all N matching filters" (Gmail pattern). Confirmation dialog states the resolved count and per-currency totals before executing.
- *Alternative rejected*: shipping thousands of IDs from the client — brittle, races with concurrent status changes, and the filter re-resolution is the natural authorization boundary anyway.

### D4 — Bulk Approve pre-check as a dry-run mode on the same endpoint
`bulk-status` with `dryRun: true` returns the pre-check result without mutating: targeted count, per-currency totals, and `paymentIncomplete: [{workerId, name, channel, missing}]` (Wise/PayPal preferred account missing email; Manual with no account and no legacy payment fields). The confirm dialog renders this; executing again with `excludeWorkerIds` approves the compliant subset.
- *Alternative rejected*: separate pre-check endpoint — same query twice, drift risk.

### D5 — Bulk Mark Paid: keep PAID-on-Xero-failure, make failures first-class
Bulk keeps its existing semantic (invoice stays PAID if Xero fails — reverting hundreds of rows on partial failure would be worse), but sync outcomes are awaited (bounded concurrency, e.g. 5 at a time — Xero rate limit is 60/min) and reported in the response instead of `.catch(console.error)`.
- Invoice list gains filter `xero=failed` (PAID + `xeroSynced=false`); new `POST /api/admin/invoices/retry-xero` accepts IDs or the same filter object, re-attempts sync without touching status, returns the same outcome summary.
- Note Vercel duration: 200 sequential Xero calls won't fit a default function budget — set `maxDuration` and batch; if a run still overruns, remaining invoices simply stay visible under `xero=failed` and are retryable, so the failure mode is benign.
- *Alternative rejected*: bulk revert-on-failure (mirror of single-invoice PUT) — partial reverts across 200 rows are harder to reason about than a visible, retryable failed set.

### D6 — Slack: one digest per bulk operation
`lib/slack.ts` gains `bulkOperationDigest({action, count, totalsByCurrency, channelBreakdown, xeroFailed})`; the bulk route calls it once instead of `invoiceStatusChanged` per invoice. Per-invoice `invoicePaidWorkerNotification` (MANUAL paymentType workers) is preserved — that one is worker-facing, not finance-channel noise. `tdSyncSummary` gains `skippedExisting`.

### D7 — TD sync: `skippedExisting` counter + month parameter
- `runTdSync` counts the `existingInvoiceWorkerIds.has(...)` branch into a new `skippedExisting`, persisted via an additive `TdSyncRun.skippedExisting Int @default(0)` column and shown in the panel toast ("1 created · 198 already existed"), last-run summary, history table, and Slack summary.
- `POST /api/admin/td-sync/run` accepts optional `{year, month}` (validated: `YYYY-MM` within the last 24 months, not the current or a future month), defaulting to previous month. Panel gets a 12-month selector defaulting to previous month. Cron route unchanged.

### D8 — Dashboard settlement card replaces the misaligned "This Month" stats
Server-render a settlement summary for a selectable `billingMonth` (default: previous month, Europe/Paris): status-breakdown counts, per-currency sums (`groupBy billingMonth+currency`), unresolved match failures, PAID-with-`xeroSynced=false` count, and derived completion (`non-VOID count == PAID count && unresolved failures == 0`). Links to `/admin/invoices?month=…`. The existing "Invoices This Month"/"Paid This Month" cards switch to the same `billingMonth` basis or are absorbed into the card.
- Channel tab counts on the invoice list come from grouping the filtered set by derived channel (cheap at this scale, single extra query).

## Risks / Trade-offs

- [Filter-scoped bulk races concurrent status changes] → per-row status guard inside the transition (`updateMany where status = expected`) means late-changed rows are skipped and counted, never corrupted; response reports `skippedWrongStatus`.
- [Live channel derivation shifts tab counts mid-session] → acceptable and intended (payment uses current account); if phase3 needs an audit trail it snapshots channel at payment execution time.
- [Xero rate limits / function timeout on 200-invoice bulk pay] → bounded concurrency + `maxDuration`; overflow lands in the retryable `xero=failed` set rather than being lost.
- [billingMonth derivation for manual invoices depends on how the worker form captures service period] → verify the worker submit payload during implementation; fall back to `invoiceDate` month, and the filter's `availableMonths` comes from actual data so nothing 404s.
- [Two month semantics during rollout (old links use invoiceDate)] → the `month` query param name stays the same; only the WHERE clause changes, and backfill runs in the same deploy.

## Migration Plan

1. Migration: add `TdSyncRun.skippedExisting` (default 0); backfill `Invoice.billingMonth` where null from `invoiceDate` (raw SQL in the same migration).
2. Deploy code (all read paths tolerate default-0 / backfilled values; no ordering hazard).
3. Rollback: revert deploy; the added column and backfilled strings are harmless to old code.

## Open Questions

- Should CRYPTO get its own tab later if crypto-paid workers grow? (Folded into Manual for now per product decision; the derivation map makes it a one-line change.)
- Does the worker invoice form capture an explicit service-period month we can trust for `billingMonth`, or do we derive from `serviceDate`/`period` text? Resolve when touching the submit route.
