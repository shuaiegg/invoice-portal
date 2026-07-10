## ADDED Requirements

### Requirement: New invoice form pre-filled from profile
The new invoice form SHALL pre-fill worker name, address, VAT number, VAT rate, payment method, and payment account from the authenticated worker's profile. These fields SHALL be editable on the form. Fields the worker fills each submission: description (textarea), period (text, e.g. "June 2026"), service date (optional date picker), quantity (number), rate (number), invoice date (date, defaults to today in Europe/Paris timezone).

#### Scenario: Form pre-fills profile data
- **WHEN** a worker with a complete profile navigates to `/invoice/new`
- **THEN** name, address, and payment fields are pre-filled from the Worker record

#### Scenario: Invoice date defaults to today in Paris timezone
- **WHEN** the form loads
- **THEN** the invoice date field defaults to today's date in Europe/Paris timezone, set client-side

### Requirement: Real-time amount calculation
The form SHALL compute and display net amount (quantity × rate), VAT amount (net × vatRate / 100), and total amount (net + VAT) in real-time as the worker types quantity, rate, or VAT rate. Amounts SHALL be displayed formatted as currency (EUR).

#### Scenario: Amounts update on input change
- **WHEN** a worker changes quantity from 10 to 20
- **THEN** net amount, VAT amount, and total amount update immediately without page reload

### Requirement: Invoice submission flow
On form submit, the system SHALL: (1) validate all required fields, (2) generate a sequential invoice number via atomic DB upsert, (3) write the Invoice record to the database, (4) fire a fire-and-forget webhook to the `invoice.submitted` n8n endpoint (if configured and enabled), (5) redirect the worker to `/invoice/[id]` for the newly created invoice. The response to the user MUST NOT wait for the webhook to complete.

#### Scenario: Successful submission saves to DB and redirects
- **WHEN** a worker submits a valid invoice form
- **THEN** an Invoice record is created in the DB with status SUBMITTED
- **THEN** the worker is redirected to `/invoice/[newId]`

#### Scenario: Webhook failure does not block submission
- **WHEN** the n8n webhook URL is unreachable
- **THEN** the invoice is still saved and the worker is redirected normally
- **THEN** `xeroSynced` remains `false` on the Invoice record

#### Scenario: Missing required field shows validation
- **WHEN** a worker submits without filling description or period
- **THEN** validation errors appear on those fields and no DB write occurs
