# Design: xero-direct

## Architecture

```
Invoice Submission (synchronous)
────────────────────────────────────────────────────────

Worker POST /api/invoices
  │
  ├─ 1. Validate form data
  ├─ 2. Generate invoice number (atomic)
  ├─ 3. Create Invoice in DB (status: SUBMITTED)
  │
  ├─ 4. syncInvoiceToXero(invoice, worker)          ← NEW (synchronous)
  │       ├─ getAccessToken()                        ← refresh if expired
  │       ├─ GET /connections → tenantId
  │       ├─ GET /Contacts?where=EmailAddress="..."  ← search
  │       ├─ POST /Contacts                          ← upsert
  │       └─ POST /Invoices (ACCPAY, DRAFT)
  │             └─ on success: db.invoice.update({ xeroSynced: true, xeroInvoiceId })
  │             └─ on failure: throw → return HTTP 500 to worker
  │
  └─ 5. notifySlack(invoice, worker)                 ← fire-and-forget, non-blocking
          └─ POST SLACK_WEBHOOK_URL

  Result: worker sees success only when Xero confirms.
```

## Token Management

```
XeroToken DB model (single row, id = "singleton")
────────────────────────────────────────────────────────
  accessToken    String    (30 min TTL)
  refreshToken   String    (60 day inactivity TTL)
  tokenExpiry    DateTime
  tenantId       String

async function getAccessToken(): Promise<string>
  1. Load row from DB
  2. If tokenExpiry > now + 2min buffer: return accessToken (2min buffer avoids edge expiry)
  3. POST https://identity.xero.com/connect/token
       grant_type=refresh_token
       refresh_token=stored.refreshToken
       client_id=XERO_CLIENT_ID
       client_secret=XERO_CLIENT_SECRET
  4. Update DB: new accessToken, refreshToken, tokenExpiry = now + 1800s
  5. Return new accessToken

Concurrent refresh protection:
  - Serverless: concurrent invoice submissions are rare in practice
    (200 workers, not a high-traffic API)
  - If two requests refresh simultaneously, second one uses a slightly
    stale token that Xero accepts (Xero has a short overlap window)
  - No DB locking needed for this scale
```

## OAuth Setup Flow (One-Time)

```
Admin visits /admin/settings/xero
  │
  ├─ Shows: "Not connected" if no XeroToken row
  └─ Button: "Connect Xero Account"
        │
        └─ GET /api/auth/xero/connect
              │
              └─ Redirect to:
                   https://login.xero.com/identity/connect/authorize
                     ?response_type=code
                     &client_id=XERO_CLIENT_ID
                     &redirect_uri=XERO_REDIRECT_URI
                     &scope=accounting.transactions accounting.contacts offline_access
                     &state=<csrf_token>

Xero → admin consents → redirect to XERO_REDIRECT_URI

GET /api/auth/xero/callback?code=...&state=...
  │
  ├─ Validate state (CSRF)
  ├─ POST https://identity.xero.com/connect/token (code exchange)
  ├─ GET https://api.xero.com/connections (get tenantId)
  ├─ db.xeroToken.upsert({ id: "singleton", accessToken, refreshToken, expiry, tenantId })
  └─ Redirect to /admin/settings/xero (shows "Connected ✓")
```

## Xero API Calls

### Contact Upsert
```
GET /api.xro/2.0/Contacts?where=EmailAddress="{email}"
  → Contacts.length > 0 → use Contacts[0].ContactID
  → Contacts.length === 0 → POST /Contacts to create

POST /Contacts body:
  { Contacts: [{ Name, EmailAddress, TaxNumber, Addresses: [{ STREET }] }] }

In both cases: update contact fields (name, address etc may have changed)
```

### Draft Bill Creation
```
POST /api.xro/2.0/Invoices
Body:
  {
    Invoices: [{
      Type: "ACCPAY",
      Contact: { ContactID },
      Date: invoice.invoiceDate,
      InvoiceNumber: invoice.invoiceNumber,   ← searchable in Xero
      Reference: invoice.invoiceNumber,
      CurrencyCode: invoice.currency || "USD",
      Status: "DRAFT",
      LineItems: [
        { Description, Quantity, UnitAmount: rate },
        // + VAT line if vatRate > 0
      ]
    }]
  }
Response: Invoices[0].InvoiceID → stored as xeroInvoiceId
```

## Slack Notification

Replace n8n Slack node with direct Incoming Webhook:

```typescript
// lib/slack.ts
export function notifySlack(payload: SlackMessage): void {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // fire-and-forget, swallow errors
}
```

Message format mirrors current n8n Slack node text.

## Error Handling

```
Xero API error during invoice submission:
  → Log error server-side
  → Invoice remains in DB with xeroSynced = false
  → Return HTTP 500: { error: "Invoice saved but Xero sync failed. Please try again." }
  → Worker sees toast error, can retry submission
  → If persistent: admin can see xeroSynced = false in invoice list
    and contact support (no Re-sync button needed — worker retries work)

Token refresh failure (refresh_token expired):
  → getAccessToken() throws XeroAuthError
  → All invoice submissions fail with "Xero connection error — please contact admin"
  → Admin notified via server logs / Slack alert
  → Admin re-runs OAuth setup at /admin/settings/xero
  → This should happen at most once every 60 days of total inactivity
```

## Files

### New
- `lib/xero.ts` — full Xero client (token mgmt + API calls)
- `lib/slack.ts` — direct Slack Incoming Webhook helper
- `app/api/auth/xero/connect/route.ts` — OAuth initiation
- `app/api/auth/xero/callback/route.ts` — OAuth callback + token storage
- `app/(admin)/admin/settings/xero/page.tsx` — Xero connection status UI

### Modified
- `prisma/schema.prisma` — add `XeroToken`, remove `WebhookConfig`
- `app/api/invoices/route.ts` — sync Xero on submit
- `app/api/invoices/[id]/route.ts` — sync Xero on edit (invoice.updated)
- `components/admin/admin-invoice-detail.tsx` — remove Re-sync button, simplify Xero status
- `app/(admin)/admin/settings/page.tsx` — replace webhook UI with Xero status

### Deleted
- `lib/webhook.ts`
- `app/api/internal/sync-status/route.ts`
- `app/api/admin/settings/webhooks/route.ts`
- `app/api/admin/settings/webhooks/[key]/route.ts`
- `app/api/admin/invoices/[id]/resync/route.ts`
- `lib/seed-webhooks.ts`
