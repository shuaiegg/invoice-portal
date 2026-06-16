## Context

Invoice submission is live in Next.js. This change wires the external integrations by building two n8n workflows and configuring the webhook URLs via the Admin Settings UI. All Xero OAuth2 complexity lives in n8n's credential system. The primary tool for building workflows is the n8n MCP (`n8n_create_workflow`, `n8n_validate_workflow`, `n8n_update_partial_workflow`).

## Goals / Non-Goals

**Goals:**
- Working end-to-end flow: invoice submitted in portal → Xero draft appears → Slack message sent → DB updated
- Reliable retry logic for Xero API failures
- Stale webhook deduplication for the edit race condition

**Non-Goals:**
- Any changes to Next.js application code
- Multi-company Xero support
- Slack OAuth (Incoming Webhook only)

## Decisions

### D1: Two separate n8n workflows

`invoice.submitted` workflow:
```
Webhook (POST) 
  → Xero: Search Contact by email
  → Xero: Create or Update Contact
  → Xero: Create Draft Bill (ACCPAY)
  → Slack: Send #finance notification
  → HTTP: POST /api/internal/sync-status
```

`invoice.updated` workflow:
```
Webhook (POST)
  → IF xeroInvoiceId present
      → Xero: Update existing Draft Bill
    ELSE
      → Xero: Create new Draft Bill (same as submitted flow)
  → HTTP: POST /api/internal/sync-status
  (no Slack step)
```

### D2: Stale webhook deduplication via updatedAt check

The `invoice.submitted` workflow starts with an HTTP Request node that calls `/api/invoices/[id]` (a new read endpoint or the existing internal endpoint) to fetch the current `updatedAt` timestamp. If the invoice has been modified since the webhook payload was generated (payload includes `updatedAt`), the workflow stops — the `invoice.updated` webhook will handle it instead.

This prevents creating duplicate Xero drafts when a worker edits immediately after submission.

### D3: Error handling — Xero failures are retryable, Slack is optional

n8n node configuration:
- Xero nodes: `onError: continueErrorOutput` with retry count 2, wait 30s between retries
- Slack node: `onError: continueRegardless` — failure does not stop the workflow
- sync-status HTTP node: `onError: continueErrorOutput` with retry count 2

### D4: Credentials configured in n8n UI (not code)

Before running this change:
1. Xero OAuth2 credential must be created in n8n (`Settings → Credentials → New → Xero OAuth2`)
2. Xero OAuth2 authorization flow completed to get initial tokens
3. Slack Incoming Webhook URL stored as an n8n credential or hardcoded in the Slack node (Incoming Webhooks don't use OAuth)

### D5: WebhookConfig seeded via Admin Settings UI

After workflows are created in n8n, their webhook URLs are copied into the Admin Settings page:
- Key: `invoice.submitted`, URL: `[n8n webhook URL]`, Environment: `production`
- Key: `invoice.updated`, URL: `[n8n webhook URL]`, Environment: `production`
- Set matching `internalSecret` values for the sync-status callback

## Risks / Trade-offs

**Xero OAuth2 initial setup requires manual authorization** → Mitigation: documented as a setup step. n8n's Xero credential handles all subsequent token refreshes automatically.

**n8n downtime means invoices don't sync to Xero** → Mitigation: `xeroSynced: false` invoices are visible in admin portal. n8n execution history allows manual re-run of failed workflows. Accepted trade-off — invoice is always saved to DB regardless.

**edit race condition (submitted + updated webhooks both fire)** → Mitigation: D2 deduplication check. Low probability but handled.

## Migration Plan

1. Complete Xero OAuth2 credential setup in n8n instance
2. Use n8n MCP tools to create `invoice.submitted` workflow node by node
3. Validate workflow with `n8n_validate_workflow`
4. Create `invoice.updated` workflow
5. Test both workflows with a real invoice submission from local dev
6. Seed WebhookConfig via Admin Settings UI
7. Submit a real invoice end-to-end and verify: Xero draft visible, Slack message received, DB `xeroSynced: true`
