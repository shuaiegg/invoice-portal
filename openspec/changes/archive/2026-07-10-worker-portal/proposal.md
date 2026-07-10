## Why

With foundation and design system in place, workers need the core self-service experience: maintaining their profile and submitting monthly invoices. This change builds the complete worker-facing portal — profile management, invoice submission (with n8n webhook dispatch), invoice history, and the HTML-based PDF print flow. This is the primary value delivery for the 200+ contractors.

## What Changes

- Worker profile page: form to create/edit all profile fields (personal info, address, VAT, payment details), profile completion indicator
- New invoice form: pre-fills from worker profile, calculates net/VAT/total in real-time, submits to DB and triggers n8n webhook
- Invoice number generation: atomic sequential counter called on submission
- Webhook dispatch: fire-and-forget POST to n8n after DB write (respects WebhookConfig enabled/environment)
- Invoice detail page: displays all invoice fields formatted for print, `window.print()` button, `@media print` CSS hides UI chrome
- Worker dashboard: paginated invoice list with StatusBadge, period, amount, link to detail
- Invoice edit/revoke: worker can edit a SUBMITTED invoice (re-opens form pre-filled, updates DB, triggers `invoice.updated` webhook); APPROVED/PAID/VOID invoices are read-only
- Profile completeness gate: if Worker record incomplete, dashboard shows a banner prompting profile completion before allowing new invoice

## Capabilities

### New Capabilities

- `worker-profile`: CRUD for Worker profile data linked to the authenticated user. Profile completeness is determined by presence of name, address, city, country, and paymentMethod. Incomplete profiles block invoice submission.
- `invoice-submission`: New invoice form flow — validates fields, generates invoice number, writes Invoice record to DB, dispatches `invoice.submitted` webhook to n8n. Returns immediately after DB write; webhook is fire-and-forget.
- `invoice-pdf-print`: Invoice detail page rendered as a print-ready HTML layout. `@media print` CSS removes nav, buttons, and page chrome. Amounts formatted with EUR currency. Dates formatted DD/MM/YYYY (Europe/Paris timezone).
- `invoice-history`: Worker dashboard listing all invoices newest-first. Columns: Invoice #, Period, Amount, Status (StatusBadge), Date. Clickable rows navigate to detail.
- `invoice-edit`: Worker can revoke and re-edit an invoice while status is SUBMITTED. Edit updates DB record and dispatches `invoice.updated` webhook. Editing is blocked once status moves to APPROVED.

### Modified Capabilities

## Impact

- **New API routes**: `GET/PUT /api/profile`, `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/[id]`, `PUT /api/invoices/[id]` (edit), `POST /api/invoices/[id]/revoke`
- **New lib**: `lib/webhook.ts` — `dispatchWebhook(key, payload)` reads WebhookConfig from DB, fires fetch with secret header if configured
- **Modified pages**: `/dashboard`, `/profile`, `/invoice/new`, `/invoice/[id]`
- **Timezone**: All date defaults set client-side; all display dates use `Europe/Paris` locale
- **No Xero or Slack code in Next.js** — fully delegated to n8n via webhook
