# Time Doctor Sync Delta Spec

> Baseline requirements live in `openspec/changes/phase2-timedoctor-integration/specs/timedoctor-sync/spec.md` (not yet synced to main specs). This delta only adds reporting transparency and month targeting; matching rules, invoice math, and the cron schedule are unchanged.

## ADDED Requirements

### Requirement: All TD-tracked workers use the review-first draft flow with VAT-inclusive amounts
Product decisions 2026-07-16 (supersede the baseline's `td_only` auto-submit requirement): every TD-imported worker SHALL have `paymentType = TD_PLUS` — sync-generated invoices land as DRAFT for the worker to review and submit; the Wise→TD_ONLY auto-submit split is retired. Sync-generated invoice amounts SHALL be VAT-inclusive: hours × rate is the gross total and any VAT is carved out of it, never added on top.

#### Scenario: Uniform draft flow
- **WHEN** the sync creates an invoice for any matched TD worker
- **THEN** the invoice status is DRAFT and the worker is notified to review and submit

#### Scenario: VAT carved out of the gross
- **WHEN** a worker with vatRate 20 works 100 hours at 12/hr
- **THEN** the invoice has totalAmount 1200, subtotal 1000, vatAmount 200, vatInclusive true

### Requirement: Sync runs count and report idempotently skipped workers
Each sync run SHALL count workers that were matched but skipped because an invoice already exists for the billing month (`skippedExisting`), persist it on the run record, and surface it wherever run results are shown (sync panel completion toast, last-run summary, run history table, Slack sync summary).

#### Scenario: Re-run after a successful sync
- **WHEN** a sync for June runs after 198 June invoices already exist and creates 1 missing invoice
- **THEN** the run records `invoicesCreated = 1` and `skippedExisting = 198`, and the completion toast reads "1 invoice created · 198 already existed" rather than implying only 1 invoice exists

### Requirement: Manual sync accepts a target billing month
The admin "Run Sync Now" action SHALL accept a target month (year + month), defaulting to the previous calendar month. The sync panel SHALL provide a month selector covering at least the previous 12 months. The cron trigger keeps its fixed previous-month behavior.

#### Scenario: Backfill an older month
- **WHEN** admin selects April 2026 and runs sync in July
- **THEN** the sync fetches April TD hours and creates invoices with `billingMonth = "2026-04"`, skipping workers who already have April invoices

#### Scenario: Default remains previous month
- **WHEN** admin runs sync on 2026-07-15 without changing the selector
- **THEN** the sync targets June 2026
