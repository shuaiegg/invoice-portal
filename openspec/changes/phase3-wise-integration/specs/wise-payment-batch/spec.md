## ADDED Requirements

### Requirement: Admin initiates batch payment for APPROVED Wise/IBAN invoices
An admin SHALL be able to select one or more APPROVED invoices with payment method Wise/IBAN from the invoice list and initiate a batch payment. The platform SHALL create Wise transfers (Steps 1–3: quote, recipient, transfer record) without funding them.

#### Scenario: Admin creates batch of 3 Wise transfers
- **WHEN** an admin selects 3 APPROVED invoices and clicks "Initiate Wise Payment"
- **THEN** a `PaymentRun` is created, 3 Wise transfers are created via API (unfunded), invoices move to `PAYMENT_PENDING` status, and a Slack summary is posted to #finance

#### Scenario: Worker missing IBAN is excluded
- **WHEN** an admin tries to include an invoice for a worker with no IBAN on file
- **THEN** that invoice is excluded with an error message: "Worker has no IBAN — update profile first"

### Requirement: Mode A — Lorena approves in Wise dashboard
When `WiseConfig.paymentMode = MODE_A`, after transfers are created the system SHALL wait for Lorena to approve them in the Wise web dashboard. No further platform action is required until the webhook fires.

#### Scenario: Mode A transfer pending approval
- **WHEN** a transfer is created in Mode A
- **THEN** the invoice status is `PAYMENT_PENDING` and the Wise dashboard shows the transfer awaiting approval

### Requirement: Mode B — Platform funds transfers immediately
When `WiseConfig.paymentMode = MODE_B`, after creating transfers the platform SHALL immediately call Wise Step 4 (fund) for each transfer.

#### Scenario: Mode B auto-funds
- **WHEN** a transfer is created in Mode B
- **THEN** the platform calls fund API immediately; if successful, invoice remains `PAYMENT_PENDING` until webhook confirms
