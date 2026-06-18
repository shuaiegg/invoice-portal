# Tasks: xero-direct

## 1. Xero Developer App Setup (Manual)
- [ ] 1.1 Create app at developer.xero.com → My Apps → New App
- [ ] 1.2 Set redirect URI to `{NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`
- [ ] 1.3 Copy Client ID and Client Secret → add to `.env.local` as `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`
- [ ] 1.4 Add `SLACK_WEBHOOK_URL` to `.env.local` (Slack → App → Incoming Webhooks)

## 2. Prisma Schema
- [ ] 2.1 Add `XeroToken` model (id "singleton", accessToken, refreshToken, tokenExpiry, tenantId, updatedAt)
- [ ] 2.2 Remove `WebhookConfig` model
- [ ] 2.3 Run `npx prisma migrate dev --name xero-direct`
- [ ] 2.4 Run `npx prisma generate`

## 3. Xero Client Library (`lib/xero.ts`)
- [ ] 3.1 `getAccessToken()` — load from DB, refresh via POST to Xero token endpoint if expired, save updated tokens
- [ ] 3.2 `getTenantId(accessToken)` — GET /connections, return first tenantId
- [ ] 3.3 `upsertXeroContact(accessToken, tenantId, worker)` — search by email, create or update, return ContactID
- [ ] 3.4 `createXeroDraftBill(accessToken, tenantId, invoice, contactId)` — POST /Invoices ACCPAY DRAFT, return InvoiceID
- [ ] 3.5 `syncInvoiceToXero(invoice, worker)` — orchestrate 3.1–3.4, update DB on success

## 4. Slack Helper (`lib/slack.ts`)
- [ ] 4.1 `notifySlack(message)` — fire-and-forget POST to `SLACK_WEBHOOK_URL`, swallow errors if URL not set

## 5. OAuth Setup Routes
- [ ] 5.1 `app/api/auth/xero/connect/route.ts` — build Xero authorization URL, redirect (admin-only via requireAdmin)
- [ ] 5.2 `app/api/auth/xero/callback/route.ts` — exchange code for tokens, fetch tenantId, upsert XeroToken row, redirect to /admin/settings/xero

## 6. Invoice API — Sync on Submit
- [ ] 6.1 `app/api/invoices/route.ts` — after DB insert, call `syncInvoiceToXero()`, on error return 500 with message
- [ ] 6.2 `app/api/invoices/[id]/route.ts` — same for invoice edit (PUT handler)
- [ ] 6.3 Both routes: call `notifySlack()` after successful Xero sync (fire-and-forget)
- [ ] 6.4 Remove `dispatchWebhook()` calls from both routes

## 7. Admin Settings — Xero Status Page
- [ ] 7.1 `app/(admin)/admin/settings/xero/page.tsx` — show XeroToken row status: connected/not connected, token age, tenantId, "Connect Xero" button linking to /api/auth/xero/connect
- [ ] 7.2 Update `app/(admin)/admin/settings/page.tsx` — remove webhook configuration UI, add link/embed to Xero settings

## 8. Admin Invoice Detail — Simplify Xero Status
- [ ] 8.1 Remove Re-sync button and `handleResync` function from `admin-invoice-detail.tsx`
- [ ] 8.2 Remove `resyncing` state
- [ ] 8.3 Simplify Xero status display: synced = show InvoiceID + sync time, not synced = show error state (only for voided or legacy invoices)

## 9. Cleanup — Delete Obsolete Code
- [ ] 9.1 Delete `lib/webhook.ts`
- [ ] 9.2 Delete `app/api/internal/sync-status/route.ts`
- [ ] 9.3 Delete `app/api/admin/settings/webhooks/route.ts`
- [ ] 9.4 Delete `app/api/admin/settings/webhooks/[key]/route.ts`
- [ ] 9.5 Delete `app/api/admin/invoices/[id]/resync/route.ts`
- [ ] 9.6 Delete `lib/seed-webhooks.ts`

## 10. Verification
- [ ] 10.1 Complete Xero OAuth flow at /admin/settings/xero — confirm XeroToken row in DB
- [ ] 10.2 Submit a new invoice as worker — confirm Xero draft bill created, `xeroSynced = true` in DB
- [ ] 10.3 Confirm Slack message received in #finance channel
- [ ] 10.4 Confirm invoice is searchable in Xero by invoice number (INV-YYYY-NNNN)
- [ ] 10.5 Test token refresh: manually set `tokenExpiry` to past in DB, submit invoice — confirm refresh works
- [ ] 10.6 Deactivate n8n workflow `K85IrVmMwLlNIC7q` to avoid duplicate bills
