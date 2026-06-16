## Why

Invoice submission is live in Next.js, but the Xero sync and Slack notification are not yet wired. This change builds the two n8n workflows that handle all external integrations: creating/updating Xero draft bills and notifying the #finance Slack channel. It also seeds the WebhookConfig records in the DB and verifies the end-to-end flow from invoice submission to Xero draft appearance. All Xero OAuth2 complexity lives exclusively in n8n.

## What Changes

- Build n8n workflow for `invoice.submitted`: receives webhook payload → upserts Xero Contact → creates Xero Draft Bill (ACCPAY) → sends Slack #finance notification → POSTs back to `/api/internal/sync-status` with xeroInvoiceId
- Build n8n workflow for `invoice.updated`: receives webhook payload → checks if xeroInvoiceId present → updates existing Xero draft (or creates new one if not yet synced) → no Slack notification on edits
- Seed WebhookConfig records via Admin Settings UI: enter n8n webhook URLs, secrets, internalSecret for both events in both environments
- Verify end-to-end: submit a test invoice → confirm Xero draft appears → confirm Slack message → confirm DB `xeroSynced: true`

## Capabilities

### New Capabilities

- `xero-sync`: n8n workflow that creates/updates Xero contacts and draft bills (ACCPAY type, DRAFT status). Uses n8n's built-in Xero credential for OAuth2 token management. Xero failures do not block the invoice — n8n retries automatically. Contact fields: Name, EmailAddress, TaxNumber, Address. Bill reference format: `{period} | {paymentMethod}`.
- `slack-notification`: n8n workflow step that sends a structured message to #finance channel via Incoming Webhook on each new invoice submission. Message includes worker name, team, period, total amount, payment details, invoice number.
- `sync-status-callback`: n8n workflow step that POSTs to Next.js `/api/internal/sync-status` after successful Xero sync, updating `xeroInvoiceId`, `xeroSynced: true`, `xeroSyncedAt` in the Invoice record.

### Modified Capabilities

## Impact

- **No Next.js code changes** — this change is entirely in n8n and the Admin Settings UI (already built in foundation)
- **Tools used**: n8n MCP tools (`n8n_create_workflow`, `n8n_validate_workflow`, `n8n_update_partial_workflow`) to build workflows programmatically
- **Credentials required in n8n**: Xero OAuth2 credential (configured in n8n instance), Slack Incoming Webhook URL
- **Environment variables in n8n**: none — all secrets managed via n8n credentials
- **DB changes**: none — WebhookConfig records inserted via Admin Settings UI
