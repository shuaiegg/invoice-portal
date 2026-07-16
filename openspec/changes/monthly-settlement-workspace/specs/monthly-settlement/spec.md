# Monthly Settlement Spec

## ADDED Requirements

### Requirement: billingMonth is the canonical month dimension for admin invoice views
The admin invoice list month filter, monthly aggregates, and CSV export SHALL filter on `Invoice.billingMonth` (format `YYYY-MM`). The available-months dropdown SHALL be built from distinct `billingMonth` values.

#### Scenario: Month filter matches billingMonth, not invoiceDate
- **WHEN** a worker submits an invoice on 2026-07-03 for June work (`billingMonth = "2026-06"`, `invoiceDate` in July) and admin filters the invoice list by June 2026
- **THEN** the invoice appears in the June list and does not appear in the July list

#### Scenario: CSV export respects the month filter
- **WHEN** admin exports CSV with month filter `2026-06`
- **THEN** the export contains exactly the invoices whose `billingMonth = "2026-06"`

### Requirement: Worker-submitted invoices populate billingMonth
Invoice create and edit paths used by workers SHALL persist `billingMonth` derived from the invoice's service period. Existing invoices with null `billingMonth` SHALL be backfilled from `invoiceDate` (its `YYYY-MM` in UTC).

#### Scenario: Manual submission sets billingMonth
- **WHEN** a worker submits an invoice whose service period is June 2026
- **THEN** the stored invoice has `billingMonth = "2026-06"`

#### Scenario: Legacy invoices are backfilled
- **WHEN** the backfill runs against an invoice with `billingMonth = null` and `invoiceDate = 2026-05-31`
- **THEN** the invoice's `billingMonth` becomes `"2026-05"`

### Requirement: One primary invoice per worker per billing month, with explicit supplements
Each worker SHALL have at most one primary invoice (`supplementNo = 0`) per `billingMonth`, enforced by a unique constraint on `(workerId, billingMonth, supplementNo)`. Additional amounts for a month whose primary invoice is still editable (DRAFT/SUBMITTED) SHALL be added as line items on that invoice. Once the primary invoice is locked (APPROVED/PAID), workers MAY create supplementary invoices (`supplementNo = 1, 2, …`) for the same `billingMonth`; supplements follow the normal SUBMITTED → APPROVED → PAID flow and are included in all month-scoped views and aggregates.

#### Scenario: Second submission while primary is editable is rejected with guidance
- **WHEN** a worker submits a new invoice for June while their June primary invoice is SUBMITTED
- **THEN** the API returns a 409 with a message directing them to edit the existing invoice, not a 500

#### Scenario: Supplement allowed after lock
- **WHEN** a worker's June primary invoice is PAID and they submit another June invoice
- **THEN** it is created as a supplement (`supplementNo = 1`) and appears in June's settlement views

#### Scenario: TD sync only checks primary invoices
- **WHEN** the TD sync runs for a month where a worker has a supplement but no primary invoice
- **THEN** the sync still creates the primary invoice for that worker

### Requirement: Admin dashboard shows a settlement card for the current settlement month
The admin dashboard SHALL show a settlement overview for the current settlement month (the previous calendar month, Europe/Paris) with: invoice count, totals grouped by currency, status breakdown (DRAFT/SUBMITTED/APPROVED/PAID/VOID counts), unresolved TD match-failure count, count of PAID invoices with failed Xero sync, and a link to the invoice list pre-filtered to that month. The card SHALL allow switching to earlier months.

#### Scenario: Early-August view focuses July
- **WHEN** admin opens the dashboard on 2026-08-03
- **THEN** the settlement card shows July 2026 figures and links to `/admin/invoices?month=2026-07`

#### Scenario: Status breakdown reflects live data
- **WHEN** July has 198 SUBMITTED, 5 APPROVED, and 12 DRAFT invoices
- **THEN** the card shows those counts per status

### Requirement: Settlement completion is derived, never stored
A settlement month SHALL be presented as complete when every non-VOID invoice with that `billingMonth` has status PAID and the month has no unresolved TD match failures. No table or column SHALL store month state, and completion SHALL impose no write locks on the month's invoices.

#### Scenario: Month becomes complete
- **WHEN** the last non-VOID June invoice transitions to PAID and June has no unresolved match failures
- **THEN** the June settlement card shows complete without any admin action

#### Scenario: Completion is reversible
- **WHEN** a new June invoice is created after the month displayed as complete
- **THEN** the June card reverts to in-progress

### Requirement: Monetary aggregates are grouped by currency
Wherever the admin UI sums invoice amounts across invoices (dashboard cards, month header, bulk-action summaries, Slack digests), the sum SHALL be computed and displayed per currency. Amounts of different currencies SHALL NOT be added together into a single figure.

#### Scenario: Mixed-currency month header
- **WHEN** June invoices total 150,300 EUR and 21,800 USD
- **THEN** the month header shows "€150,300.00 + $21,800.00", not a single combined number

#### Scenario: Single-currency month stays simple
- **WHEN** all June invoices are EUR
- **THEN** the header shows one EUR amount
