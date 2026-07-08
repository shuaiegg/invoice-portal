## Why

After Phase 2 auto-generates invoices, the finance team still manually creates Wise transfers one by one via CSV upload. Phase 3 connects the portal directly to the Wise API so Lorena can initiate all Wise/IBAN payments in one action, with the platform tracking every transfer and auto-marking invoices PAID via webhook — eliminating the manual spreadsheet tracking step.

## What Changes

- **WiseConfig model**: Stores API key, profileId, sandbox/production toggle, and payment mode (Mode A / Mode B)
- **PaymentRun + PaymentRunItem audit models**: Every batch payment action is logged with full transfer details for audit and reconciliation
- **Batch payment queue**: Admin selects invoices → platform creates Wise transfers (Steps 1–3, money not moved) → Mode A: Lorena approves in Wise dashboard; Mode B: platform funds immediately
- **Wise webhook receiver** (`/api/webhooks/wise`): Verifies HMAC-SHA256 signature, receives `outgoing_payment_sent` events, auto-marks invoices PAID
- **Webhook auto-registration**: When admin saves Wise API key in settings, platform registers the webhook subscription with Wise automatically
- **Wise sandbox support**: Toggle in settings to use `https://api.sandbox.transferwise.tech` for testing

## Capabilities

### New Capabilities
- `wise-payment-batch`: Admin selects APPROVED Wise/IBAN invoices, platform creates Wise transfers and tracks them
- `wise-webhook-receiver`: Receives and verifies Wise `outgoing_payment_sent` events, auto-marks invoices PAID
- `payment-run-audit`: `PaymentRun` + `PaymentRunItem` records capturing full lifecycle of every batch payment
- `wise-settings`: Admin settings page for Wise API key, payment mode, sandbox toggle, webhook registration

### Modified Capabilities
- `invoice-notifications`: Auto-PAID invoices (via Wise webhook) trigger worker email/Slack notification — distinct from manual-PAID path

## Impact

- **Database**: New `WiseConfig`, `PaymentRun`, `PaymentRunItem` models; `Invoice` gains `wiseTransferId`, `paymentRunItemId`
- **APIs**: `POST /api/admin/payments/wise-batch`, `POST /api/webhooks/wise`, `POST /api/admin/settings/wise`
- **Environment variables**: `WISE_API_KEY` (or stored in DB), `WISE_WEBHOOK_SECRET`
- **External**: Wise Business API (sandbox + production); one-time webhook subscription registration
- **Non-goals**: Revolut/crypto/PayPal API integration (remain manual), no automatic TD→payment pipeline (that's Phase 4), no multi-currency per transfer batch in v1
