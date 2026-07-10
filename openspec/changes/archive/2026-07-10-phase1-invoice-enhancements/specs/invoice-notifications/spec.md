## ADDED Requirements

### Requirement: Finance team notified on new invoice submission
When a worker submits an invoice, the system SHALL send a Slack notification to the #finance channel. The message SHALL include the worker's name, invoice number, total amount, and currency.

#### Scenario: Worker submits invoice
- **WHEN** a worker submits an invoice for €1,040
- **THEN** a Slack message is posted to #finance: "New invoice submitted: [Worker Name] — INV-2026-0042 — €1,040"

#### Scenario: Slack failure does not block invoice submission
- **WHEN** the Slack webhook is unreachable at submission time
- **THEN** the invoice is saved successfully and the error is logged; the API does not return an error to the worker

### Requirement: Finance team notified on invoice status change
When an admin changes an invoice status (SUBMITTED→APPROVED, APPROVED→PAID, any→VOID), the system SHALL send a Slack notification to #finance. The message SHALL include invoice number, worker name, old status, and new status.

#### Scenario: Admin approves invoice
- **WHEN** an admin changes invoice status from SUBMITTED to APPROVED
- **THEN** a Slack message is posted to #finance: "Invoice INV-2026-0042 (Worker Name): SUBMITTED → APPROVED"

#### Scenario: Admin voids invoice
- **WHEN** an admin changes invoice status to VOID
- **THEN** a Slack message is posted to #finance with the status change

### Requirement: Worker notified when manually-paid invoice is marked PAID
When an invoice for a `manual` payment type worker is marked PAID by an admin, the system SHALL send a Slack notification (or email if Slack is not applicable) to the worker. This notification SHALL NOT fire for invoices auto-marked PAID via Wise webhook (td_only/td_plus paths).

#### Scenario: Manual worker invoice marked PAID
- **WHEN** an admin marks a `manual` worker's invoice as PAID
- **THEN** the worker receives a notification: "Your invoice INV-2026-0042 (€1,040) has been paid"

#### Scenario: Auto-paid invoice does not trigger worker notification
- **WHEN** a Wise webhook auto-marks a `td_only` worker's invoice as PAID
- **THEN** no duplicate worker notification is sent via this mechanism
