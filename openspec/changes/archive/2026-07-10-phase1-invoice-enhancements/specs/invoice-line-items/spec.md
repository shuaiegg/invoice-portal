## ADDED Requirements

### Requirement: Invoice has multiple line items
An invoice SHALL contain one or more line items. Each line item has a description (string), quantity (positive decimal), unit rate (decimal), and computed amount (quantity × rate). The invoice total amount SHALL equal the sum of all line item amounts. Negative unit rates represent deductions.

#### Scenario: Worker creates invoice with two lines
- **WHEN** a worker submits an invoice with lines `[{desc:"Oct hours", qty:80, rate:13}, {desc:"Tool bonus", qty:1, rate:200}]`
- **THEN** the invoice total is €1240 and both lines are stored

#### Scenario: Worker adds a deduction line
- **WHEN** a worker submits a line with negative rate `{desc:"Equipment advance", qty:1, rate:-150}`
- **THEN** the line amount is −€150 and the invoice total reflects the deduction

#### Scenario: Invoice with zero lines is rejected
- **WHEN** a worker submits an invoice with an empty lines array
- **THEN** the API returns 422 with error "Invoice must have at least one line item"

### Requirement: Line items are editable while invoice is in SUBMITTED status
A worker SHALL be able to add, edit, or remove line items on an invoice while it is in `SUBMITTED` status. Once status advances to `APPROVED` or beyond, line items are locked.

#### Scenario: Worker edits line on SUBMITTED invoice
- **WHEN** a worker updates a line item on a SUBMITTED invoice
- **THEN** the change is saved and invoice total is recalculated

#### Scenario: Worker cannot edit line on APPROVED invoice
- **WHEN** a worker attempts to update a line item on an APPROVED invoice
- **THEN** the API returns 403

### Requirement: Total amount is always server-computed
The invoice `totalAmount` field SHALL be computed server-side as the sum of all line items. The client MUST NOT send a `totalAmount` in create or update requests; the server SHALL ignore it if present.

#### Scenario: Client sends totalAmount in request
- **WHEN** a client sends `{totalAmount: 999, lines: [{qty:1, rate:100}]}`
- **THEN** the stored totalAmount is 100 (server-computed), not 999

### Requirement: Existing invoices migrated to single line item
All invoices created before this change SHALL be migrated to have a single line item with description matching the original invoice description and amount matching the original amount (quantity=1, rate=amount).

#### Scenario: Migration of legacy invoice
- **WHEN** the migration runs on an invoice with amount=500 and description="November 2025"
- **THEN** the invoice has one line item: `{desc:"November 2025", qty:1, rate:500}`
