## ADDED Requirements

### Requirement: Invoice revoke and re-edit
A worker SHALL be able to revoke and edit an invoice only while its status is `SUBMITTED`. On the invoice detail page, a "Edit Invoice" button SHALL be visible for SUBMITTED invoices. Clicking it navigates to a pre-filled edit form. On re-submit, the Invoice record is updated in the DB and an `invoice.updated` webhook is dispatched fire-and-forget. Invoices with status APPROVED, PAID, or VOID SHALL show a read-only view with no edit button.

#### Scenario: Edit button visible on SUBMITTED invoice
- **WHEN** a worker views `/invoice/[id]` for a SUBMITTED invoice
- **THEN** an "Edit Invoice" button is visible

#### Scenario: Edit button absent on non-SUBMITTED invoice
- **WHEN** a worker views `/invoice/[id]` for an APPROVED invoice
- **THEN** no edit button is shown and the page is fully read-only

#### Scenario: Edit form pre-fills existing values
- **WHEN** a worker clicks "Edit Invoice"
- **THEN** all form fields are pre-filled with the current invoice values

#### Scenario: Successful edit updates DB and dispatches webhook
- **WHEN** a worker submits the edit form with valid data
- **THEN** the Invoice record is updated in the DB
- **THEN** the `invoice.updated` webhook is dispatched fire-and-forget
- **THEN** the worker is redirected to `/invoice/[id]` showing updated values

### Requirement: Invoice number preserved on edit
When a worker edits an invoice, the invoice number SHALL remain unchanged. The edit updates the content fields only (description, period, amounts, etc.) — never the invoice number.

#### Scenario: Invoice number unchanged after edit
- **WHEN** a worker edits and re-submits an invoice
- **THEN** the `invoiceNumber` field in the DB is identical to before the edit
