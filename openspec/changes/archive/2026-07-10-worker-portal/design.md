## Context

The design system provides UI primitives. This change builds the complete worker-facing application on top of that foundation: profile management, invoice submission, invoice history, and print-based PDF. The most architecturally significant decisions here are the webhook dispatch pattern and the timezone handling for invoice dates.

## Goals / Non-Goals

**Goals:**
- Complete worker self-service flow from profile setup to invoice submission to history
- Fire-and-forget webhook dispatch that never blocks the user response
- Print-based PDF that works reliably without server-side rendering libraries

**Non-Goals:**
- Xero or Slack integration (handled by n8n-integration change)
- Admin views of worker data
- Email notifications

## Decisions

### D1: Webhook dispatch via lib/webhook.ts (fire-and-forget)

```ts
// lib/webhook.ts
export async function dispatchWebhook(key: string, payload: object) {
  const config = await db.webhookConfig.findUnique({ where: { key, environment: NODE_ENV } })
  if (!config?.enabled) return
  // Non-blocking: do not await
  fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => {}) // swallow errors — n8n handles retry
}
```

Called after the DB write in the invoice submission API route. The user response is sent immediately after the DB write — the webhook fetch runs asynchronously and its result is never awaited. On Vercel, this works because the response is returned before the function exits, but the event loop continues for in-flight promises.

**Note**: On Vercel Serverless, fire-and-forget has a risk of being cut off if the function exits before the fetch completes. Mitigation: use `waitUntil` from Vercel's edge helpers if available, or accept the small risk given n8n has a dead-letter queue approach via manual re-runs.

### D2: Invoice date defaults set client-side

The "Invoice Date" field in the new invoice form defaults to today in `Europe/Paris` timezone:

```ts
// In a 'use client' component
const defaultDate = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date())
```

All date display in the portal uses `Europe/Paris` locale. The DB stores the date as UTC midnight of the selected date.

### D3: HTML + @media print for PDF (no server-side PDF library)

The invoice detail page (`/invoice/[id]`) doubles as the print template. CSS:

```css
@media print {
  .no-print { display: none; }
  body { font-family: Inter, sans-serif; }
}
```

The "Download PDF" button calls `window.print()`. This approach:
- Has zero timeout risk (no server-side processing)
- Produces consistent output across modern browsers
- Is fully acceptable for accounting purposes
- Eliminates `@react-pdf/renderer` dependency

### D4: Profile completeness gate

Profile completeness is checked server-side in the dashboard Server Component by querying the Worker record. The check result is passed as a prop to the client dashboard component. No client-side re-fetching needed.

Required fields for completeness: `name`, `address`, `city`, `country`, `paymentMethod`.

### D5: API routes are all Node.js (not Edge)

All `/api/*` routes in this change use Prisma — they cannot run on Edge Runtime. They implicitly use Node.js runtime (Next.js default for route handlers). No explicit `export const runtime` needed.

### D6: Invoice payload sent to n8n

Full denormalized payload (not just ID) to avoid n8n needing a callback to fetch data:

```json
{
  "invoiceId": "...",
  "invoiceNumber": "INV-2026-0001",
  "worker": { "name": "...", "email": "...", "address": "...", "vatNumber": "...", ... },
  "invoice": { "description": "...", "period": "...", "quantity": 10, "rate": 500, ... },
  "xeroInvoiceId": null  // null on submitted, populated on updated
}
```

## Risks / Trade-offs

**Fire-and-forget on Vercel may miss some webhook deliveries** → Mitigation: n8n Admin Settings in the portal shows `xeroSynced: false` invoices, enabling manual re-trigger. Accepted trade-off for v1.

**Print PDF cross-browser consistency** → Mitigation: Chrome/Edge (Chromium) renders consistently; Firefox minor differences are acceptable for an internal tool. Test in Chrome before shipping.

**Real-time amount calculation on the form** → Implement as a controlled `'use client'` component; amounts recalculate on every keystroke using simple arithmetic. No debounce needed for instant feedback.

## Migration Plan

1. Create `lib/webhook.ts`
2. Build profile page + API (`/api/profile`)
3. Build invoice submission form + API (`/api/invoices` POST)
4. Build invoice detail page with print CSS
5. Build worker dashboard with invoice list + pagination
6. Add invoice edit capability + `invoice.updated` webhook dispatch
7. Add profile completeness gate to dashboard
8. Verify end-to-end: register → complete profile → submit invoice → view in dashboard → print
