## Why

The current Xero integration uses a fire-and-forget webhook to n8n, which introduces silent failure modes: if n8n is down or the Xero OAuth token has expired, invoices are marked "submitted" but never reach Xero, and neither the worker nor the admin receives any notification. Recovery requires manual admin intervention via the Re-sync button. This architecture also adds significant accidental complexity — a WebhookConfig database table, an internal callback API, fire-and-forget dispatch logic, and a "Pending Sync" UX state — all of which exist solely to patch around the async blind spot.

Direct Xero integration from Next.js makes the sync synchronous: the invoice submission either succeeds end-to-end (Xero draft bill created, `xeroSynced = true`) or returns an explicit error the worker can act on immediately. No silent failures, no pending states, no Re-sync button.

## What Changes

**New:**
- `lib/xero.ts` — Xero API client: OAuth token refresh, tenant ID lookup, contact upsert, draft bill creation
- `XeroToken` Prisma model — stores `accessToken`, `refreshToken`, `tokenExpiry`, `tenantId` (single row)
- `/api/auth/xero/connect` + `/api/auth/xero/callback` — one-time admin-only OAuth setup flow
- Env vars: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`

**Modified:**
- `app/api/invoices/route.ts` — replace `dispatchWebhook("invoice.submitted")` with synchronous `syncInvoiceToXero()`
- `app/api/invoices/[id]/route.ts` (edit flow) — same replacement for `invoice.updated`
- Slack notification — replace n8n Slack node with direct Incoming Webhook POST (one `fetch()` call, fire-and-forget is acceptable here since Slack notification failure should not block invoice submission)

**Deleted:**
- `lib/webhook.ts` and all `dispatchWebhook()` call sites
- `app/api/internal/sync-status/route.ts`
- `app/api/admin/settings/webhooks/` routes (GET + PUT)
- `app/api/admin/invoices/[id]/resync/route.ts`
- `WebhookConfig` Prisma model + migration
- `XeroSynced` "Pending" state UI in admin invoice detail
- Re-sync button in `admin-invoice-detail.tsx`
- Admin webhook settings page (`app/(admin)/admin/settings/page.tsx` simplified)
- n8n workflow `K85IrVmMwLlNIC7q` (can be deactivated once live)

## Capabilities

### New Capabilities

- `xero-oauth-setup`: Admin-only one-time setup page at `/admin/settings/xero` that initiates the Xero OAuth2 Authorization Code flow. Stores `access_token`, `refresh_token`, `token_expiry`, and `tenantId` in the `XeroToken` DB table. Shows connection status (connected / token age / last sync).

- `xero-sync-on-submit`: Synchronous Xero draft bill creation on invoice submission. Contact is upserted by email before bill creation. On success: `xeroSynced = true`, `xeroInvoiceId` set, `xeroSyncedAt` timestamped. On failure: invoice submission returns HTTP 500 with a user-facing error ("Xero sync failed — please try again or contact support").

### Modified Capabilities

- `invoice-submission`: Now fully synchronous end-to-end. Worker sees success only after Xero draft bill is confirmed created.

- `admin-invoice-detail`: Remove Re-sync button and "Pending Sync" status. `xeroSynced` is always true for non-voided invoices (set at creation time). Voided invoices show "Not synced — invoice voided".

- `admin-settings`: Webhook configuration section replaced by Xero connection status card. Shows OAuth connection health, token expiry, last successful sync.

### Removed Capabilities

- `webhook-config`: Admin UI for managing n8n webhook URLs and secrets — no longer needed.
- `resync`: Manual Re-sync to Xero button — not needed when sync is synchronous.

## Impact

- **DB migration required**: `prisma migrate dev` — adds `XeroToken` table (new), removes `WebhookConfig` table (migration with data drop — backup webhook config before running)
- **Env vars required**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`, `SLACK_WEBHOOK_URL` (replaces all current `WEBHOOK_*` vars)
- **One-time setup**: After deploy, admin must visit `/admin/settings/xero` and complete the Xero OAuth flow to connect the account
- **n8n**: Workflow `K85IrVmMwLlNIC7q` should be deactivated after the new integration is live and verified to avoid duplicate Xero bills
- **Modified files**: `prisma/schema.prisma`, `lib/xero.ts` (new), `lib/webhook.ts` (delete), `app/api/invoices/route.ts`, `app/api/invoices/[id]/route.ts`, `app/api/auth/xero/` (new), `components/admin/admin-invoice-detail.tsx`, `app/(admin)/admin/settings/page.tsx`
