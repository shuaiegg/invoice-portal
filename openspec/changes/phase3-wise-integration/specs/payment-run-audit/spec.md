## ADDED Requirements

### Requirement: Every batch payment is recorded in a PaymentRun
When an admin initiates a batch payment, the system SHALL create a `PaymentRun` record capturing: initiator (admin userId), run timestamp, total invoices, total amount, payment mode, and status. Each invoice in the batch SHALL have a `PaymentRunItem` record with its Wise transfer ID and status.

#### Scenario: PaymentRun created on batch initiation
- **WHEN** an admin initiates a batch of 5 invoices
- **THEN** one `PaymentRun` record exists with `status=PROCESSING` and 5 `PaymentRunItem` records

#### Scenario: PaymentRunItem updated on webhook
- **WHEN** the Wise webhook fires for a transfer in the run
- **THEN** the corresponding `PaymentRunItem.status` updates to `PAID` and the `PaymentRun` totals are recalculated

### Requirement: PaymentRun records are immutable once created
`PaymentRun` and `PaymentRunItem` records SHALL NOT be deletable via the admin UI. They serve as the permanent audit log. Only `status` fields may be updated (by system events, never by admin UI).

#### Scenario: Admin cannot delete payment run
- **WHEN** an admin attempts to delete a PaymentRun via the API
- **THEN** the endpoint returns 403

### Requirement: Admin can view payment run history
The admin SHALL be able to view a list of all payment runs with: date, initiator, invoice count, total amount, and status (PROCESSING / COMPLETE / PARTIAL).

#### Scenario: Admin views payment run list
- **WHEN** an admin visits `/admin/payments`
- **THEN** they see a table of past runs with status badges and drill-down to individual items
