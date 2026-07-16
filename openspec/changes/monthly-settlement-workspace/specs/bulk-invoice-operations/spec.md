# Bulk Invoice Operations Spec

## ADDED Requirements

### Requirement: Bulk Approve transitions SUBMITTED invoices to APPROVED
Admin SHALL be able to bulk-approve invoices. The operation SHALL only transition invoices currently in SUBMITTED status, using the same transition guard as single-invoice updates; invoices in any other status within the selection SHALL be skipped and counted, never failed.

#### Scenario: Mixed selection approves only SUBMITTED
- **WHEN** admin bulk-approves a selection containing 118 SUBMITTED and 2 already-APPROVED invoices
- **THEN** 118 become APPROVED and the result reports 118 approved, 2 skipped

### Requirement: Bulk selection can target all invoices matching the current filter
Bulk Approve and bulk Mark Paid SHALL support a filter-scoped mode where the server resolves the target set from the current filters (billingMonth, channel, status, worker name) at execution time, instead of an explicit invoice-ID list. The UI SHALL offer "select all N matching" when the filtered set spans multiple pages, and SHALL state the resolved count in the confirmation.

#### Scenario: Select all across pages
- **WHEN** the June + Wise + SUBMITTED filter matches 120 invoices across 6 pages and admin uses "select all 120" then bulk Approve
- **THEN** all 120 invoices are approved in one operation without visiting other pages

#### Scenario: Filter resolved server-side
- **WHEN** a filter-scoped bulk request is executed
- **THEN** the server derives the invoice set from the filter parameters itself; client-supplied IDs are not required

### Requirement: Bulk Approve pre-checks payment details
Before executing a bulk Approve, the system SHALL report which target workers have no payment trail at all: no payment account for their derived channel, no payment accounts of any kind, and no TD/legacy payment fields. A missing account email alone SHALL NOT flag a worker while payments are executed through TD/Wise export files outside the Portal (pre-phase3). Admin SHALL be able to proceed with the compliant subset, leaving flagged invoices untouched.

#### Scenario: Worker with no payment trail flagged
- **WHEN** 3 of 120 workers in a bulk-approve target have no payment accounts and no TD payment method on record
- **THEN** the pre-check lists those 3 workers and offers to approve the remaining 117

#### Scenario: Missing email alone does not block
- **WHEN** a Wise-channel worker has a WISE account without an email but a TD payment method on record
- **THEN** the pre-check does not flag them

### Requirement: Bulk Mark Paid reports per-invoice Xero outcomes
Bulk Mark Paid (APPROVED → PAID) SHALL report, on completion, how many invoices were marked paid, how many synced to Xero, and how many failed Xero sync. Invoices remain PAID when their Xero sync fails (existing behavior), but failures SHALL be visible in the result summary rather than only in server logs.

#### Scenario: Partial Xero failure surfaced
- **WHEN** admin bulk-marks 200 invoices paid and 5 Xero syncs fail
- **THEN** the result shows "200 paid · 195 synced · 5 Xero failed" and the 5 are identifiable in the list

### Requirement: Failed Xero syncs are filterable and retryable in bulk
The admin invoice list SHALL offer a filter for PAID invoices with failed Xero sync, and a bulk retry action that re-attempts sync for the selected invoices without changing their status.

#### Scenario: Retry failed syncs
- **WHEN** admin filters "Xero sync failed", selects all 5 results, and triggers retry
- **THEN** each invoice's Xero sync is re-attempted and the summary reports how many now succeeded

### Requirement: Bulk operations send one aggregated Slack digest
A bulk Approve or bulk Mark Paid SHALL send a single Slack digest to the finance channel (operation, invoice count, per-currency totals, channel breakdown, Xero failure count if any) instead of one status-change message per invoice. Per-invoice worker-facing payment notifications for MANUAL-paymentType workers SHALL still be sent individually.

#### Scenario: One digest for 100 invoices
- **WHEN** admin bulk-marks 100 invoices paid (60 Wise, 25 PayPal, 15 Manual)
- **THEN** the finance channel receives exactly one message summarizing the operation, and each MANUAL-paymentType worker still receives their individual payment notification
