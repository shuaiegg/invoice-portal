## ADDED Requirements

### Requirement: Slack #finance notification on new invoice
After successful Xero bill creation, the `invoice.submitted` workflow SHALL send a message to the #finance Slack channel via Incoming Webhook. The message SHALL include: worker name, team, period, total amount, net amount, VAT amount, payment method, payment account, invoice number.

#### Scenario: Slack message sent after Xero sync
- **WHEN** the invoice.submitted workflow completes Xero contact upsert and bill creation
- **THEN** a formatted message is posted to #finance with all required fields

#### Scenario: Slack step does not run on invoice.updated
- **WHEN** the invoice.updated workflow executes
- **THEN** no Slack message is sent — only Xero draft is updated

### Requirement: Slack failure does not block Xero sync
If the Slack Incoming Webhook call fails, the workflow SHALL continue to the sync-status callback step. The Slack failure SHALL be logged in n8n execution history but SHALL NOT cause the overall workflow to fail.

#### Scenario: Slack error is non-fatal
- **WHEN** the Slack webhook returns an error
- **THEN** n8n logs the error but proceeds to update xeroSynced in the Next.js DB
