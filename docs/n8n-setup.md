# n8n Webhook Setup Guide

This guide explains how to connect the Invoice Portal to n8n so that invoice events are routed to Slack (or any other system).

---

## Overview

The portal fires structured JSON webhooks for every business event. n8n receives these and decides what to do — send a Slack message, post to another system, filter by event type, etc.

All events share the same payload envelope:

```json
{
  "eventKey": "invoice.submitted",
  "timestamp": "2026-09-23T10:00:00.000Z",
  "environment": "production",
  ...event-specific fields...
}
```

---

## Step 1 — Create the n8n Workflow

You can use **one workflow** for all events (recommended) or separate workflows per event.

### Single workflow (recommended)

1. In n8n, create a new workflow
2. Add a **Webhook** trigger node
   - HTTP Method: `POST`
   - Path: choose any path, e.g. `invoice-portal`
   - Authentication: **Header Auth** → Header Name: `X-Webhook-Secret`, Value: a secret string you choose
3. Add a **Switch** node after the Webhook, branching on `{{ $json.eventKey }}`
4. Add one branch per event key (see list below)
5. At the end of each branch, add a **Slack** node (or HTTP Request, etc.)

### Minimal single-Slack setup

If you just want everything in one Slack channel:

```
Webhook trigger → Code node (format message) → Slack node
```

Sample Code node (JavaScript):

```javascript
const key = $input.first().json.eventKey;
const d = $input.first().json;

const messages = {
  "invoice.submitted":   `📥 New invoice: ${d.invoiceNumber} — ${d.worker?.name} · ${d.invoice?.totalAmount} ${d.invoice?.currency}`,
  "invoice.updated":     `✏️ Invoice updated: ${d.invoiceNumber} — ${d.worker?.name}`,
  "invoice.revoked":     `↩️ Invoice revoked: ${d.invoiceNumber} — ${d.worker?.name}`,
  "invoice.status_changed": `🔄 ${d.invoiceNumber} status: ${d.from} → ${d.to} (${d.worker?.name})`,
  "invoice.paid":        `💰 Paid: ${d.invoiceNumber} — ${d.worker?.name} · ${d.invoice?.totalAmount} ${d.invoice?.currency}`,
  "invoice.changes_requested": `📝 Changes requested on ${d.invoiceNumber} — ${d.worker?.name}${d.note ? `\nNote: ${d.note}` : ""}`,
  "invoice.bulk_completed": `📦 Bulk ${d.action}: ${d.count} invoices${d.xeroFailed ? ` (${d.xeroFailed} Xero failures)` : ""}`,
  "worker.invited":      `👤 Worker invited: ${d.worker?.name} (${d.worker?.email})`,
  "td.sync_completed":   `✅ TD sync: ${d.invoicesCreated} invoices created · ${d.matchFailed} unmatched`,
  "td.sync_failed":      `🔴 TD sync failed — check Admin → Settings → Time Doctor`,
  "td.draft_ready":      `📋 TD draft ready for ${d.worker?.name} — ${d.invoice?.period}`,
};

return [{ json: { text: messages[key] ?? `Event: ${key}` } }];
```

---

## Step 2 — Configure Webhook URLs in the Portal

After the workflow is active, copy the webhook URL from n8n.

### Via Admin UI

1. Go to **Admin → Settings**
2. Scroll to **n8n Webhook Configuration**
3. For each event key, click Edit and:
   - Paste the n8n webhook URL
   - Set the **Secret** to match what you configured in n8n (sent as `X-Webhook-Secret` header)
   - Toggle **Enabled** on
4. The **Last Triggered** column updates after each real event fires — use it to confirm delivery

### Via seed script (faster for first setup)

Set environment variables and run:

```bash
N8N_INVOICE_SUBMITTED_URL=https://your-n8n.com/webhook/invoice-portal \
N8N_INVOICE_UPDATED_URL=https://your-n8n.com/webhook/invoice-portal \
npx tsx lib/seed-webhooks.ts
```

This pre-populates the two main event keys. The remaining 9 keys are seeded as **disabled** with placeholder URLs — enable them individually in the Admin UI once you've set the real URL.

---

## Event Reference

| Event Key | Trigger | Key Payload Fields |
|-----------|---------|-------------------|
| `invoice.submitted` | Worker submits invoice | `invoiceId`, `invoiceNumber`, `worker.id/name`, `invoice.period/totalAmount/currency` |
| `invoice.updated` | Worker edits submitted invoice | Same as above |
| `invoice.revoked` | Worker revokes submitted invoice | Same as above |
| `invoice.status_changed` | Admin changes any invoice status | + `from`, `to` |
| `invoice.paid` | Admin marks invoice as paid | + `worker.paymentType`, `worker.email` |
| `invoice.changes_requested` | Admin sends invoice back to draft | + `note` |
| `invoice.bulk_completed` | Bulk approve or mark-paid completes | `action`, `count`, `totalsByCurrency`, `xeroFailed` |
| `worker.invited` | Worker imported via CSV | `worker.id/name/email/currency` |
| `td.sync_completed` | Monthly TD sync finishes | `invoicesCreated`, `skippedExisting`, `matchFailed`, `inactiveSkipped`, `totalsByCurrency` |
| `td.sync_failed` | TD sync fails to start | _(no extra fields)_ |
| `td.draft_ready` | TD draft invoice created for a worker | `worker.name`, `invoice.period/invoiceNumber` |

---

## Routing to Different Slack Channels

Use a **Switch** node in n8n branching on `eventKey`:

| Branch | Event Keys | Suggested Channel |
|--------|-----------|-------------------|
| Finance operations | `invoice.submitted`, `invoice.updated`, `invoice.revoked` | `#finance` |
| Status changes | `invoice.status_changed`, `invoice.paid`, `invoice.bulk_completed` | `#finance` |
| Worker comms | `invoice.changes_requested`, `worker.invited`, `td.draft_ready` | `#worker-updates` |
| System health | `td.sync_completed`, `td.sync_failed` | `#finance-ops` |

---

## Verifying Delivery

- **Admin UI**: the **Last Triggered** timestamp on each webhook row updates after every successful dispatch
- **n8n**: check the workflow execution log for received payloads and any errors
- **Test manually**: use n8n's built-in test webhook feature, or `curl`:

```bash
curl -X POST https://your-n8n.com/webhook/invoice-portal \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{"eventKey":"invoice.submitted","invoiceNumber":"INV-2026-0001","worker":{"name":"Test Worker"},"invoice":{"totalAmount":1000,"currency":"EUR","period":"2026-08"},"timestamp":"2026-09-01T00:00:00Z","environment":"production"}'
```

---

## Troubleshooting

**Webhook not firing**
- Check that the event row is **Enabled** in Admin → Settings → n8n Webhook Configuration
- Check the `environment` column matches (`production` vs `development`)

**n8n receives the request but Slack message is missing**
- Check the Switch node branch — the `eventKey` value must exactly match the case shown above
- Check n8n execution logs for errors in the Slack node

**`X-Webhook-Secret` mismatch**
- The secret in Admin Settings must exactly match what you set in the n8n Webhook node's Header Auth
