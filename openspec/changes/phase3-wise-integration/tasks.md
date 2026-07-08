## 1. Database Schema

- [ ] 1.1 Add `WiseConfig` model (id, apiKey, profileId, paymentMode enum, sandbox bool, webhookSubscriptionId)
- [ ] 1.2 Add `PaymentRun` model (id, initiatedBy, runAt, status, invoiceCount, totalAmount, paymentMode, notes)
- [ ] 1.3 Add `PaymentRunItem` model (id, paymentRunId, invoiceId, wiseTransferId, amount, currency, status, errorMessage)
- [ ] 1.4 Add `Invoice.wiseTransferId` nullable string field
- [ ] 1.5 Add `Invoice.paymentRunItemId` nullable FK field
- [ ] 1.6 Run `npx prisma migrate dev --name phase3-wise-integration`

## 2. Wise API Client

- [ ] 2.1 Create `lib/wise.ts` with base URL toggle (sandbox vs production from `WiseConfig`)
- [ ] 2.2 Implement `getProfile()` — fetch Wise profile ID to validate API key
- [ ] 2.3 Implement `createQuote(profileId, amount, sourceCurrency, targetCurrency)`
- [ ] 2.4 Implement `createRecipient(profileId, worker)` — create or retrieve cached IBAN recipient
- [ ] 2.5 Implement `createTransfer(targetAccountId, quoteId, invoiceId, reference)` — uses invoiceId as customerTransactionId
- [ ] 2.6 Implement `fundTransfer(profileId, transferId)` — Step 4, Mode B only
- [ ] 2.7 Implement `registerWebhookSubscription(profileId, appUrl)` — POST /v3/profiles/{id}/subscriptions
- [ ] 2.8 Implement `listWebhookSubscriptions(profileId)` — check for existing subscription before creating

## 3. Batch Payment Orchestration

- [ ] 3.1 Create `lib/wise-batch.ts` — main batch function: iterate invoices → quote → recipient → transfer (→ fund if Mode B)
- [ ] 3.2 Create `PaymentRun` record on batch start; create `PaymentRunItem` per invoice
- [ ] 3.3 Implement 1 req/sec rate limiting between transfer creations
- [ ] 3.4 Update `Invoice.status` to `PAYMENT_PENDING` and store `wiseTransferId` after transfer created
- [ ] 3.5 Handle partial failures: failed transfers logged in `PaymentRunItem.errorMessage`, batch continues
- [ ] 3.6 Post Slack #finance summary on batch completion

## 4. Webhook Receiver

- [ ] 4.1 Create `POST /api/webhooks/wise` route — excluded from auth middleware
- [ ] 4.2 Implement HMAC-SHA256 signature verification using `X-Wise-Signature` header
- [ ] 4.3 Handle `outgoing_payment_sent` event: find invoice by `customerTransactionId`, mark PAID
- [ ] 4.4 Update `PaymentRunItem.status` to PAID on webhook receipt
- [ ] 4.5 Trigger worker notification (Slack/email) for auto-paid invoices
- [ ] 4.6 Return 200 for unknown transfer IDs (prevent Wise retries) with warning log

## 5. Admin Settings — Wise

- [ ] 5.1 Create settings page `/admin/settings/wise`
- [ ] 5.2 API key input + "Test Connection" button (calls `getProfile()`, shows profile name)
- [ ] 5.3 Payment mode selector: Mode A (Manual approval in Wise) / Mode B (Auto-fund)
- [ ] 5.4 Sandbox toggle with prominent warning banner
- [ ] 5.5 On save: auto-register webhook subscription if not already registered

## 6. Admin Payments UI

- [ ] 6.1 Create `/admin/payments` page — PaymentRun history table
- [ ] 6.2 PaymentRun detail page — list of PaymentRunItems with transfer status
- [ ] 6.3 Invoice list: add checkbox selection for APPROVED Wise/IBAN invoices
- [ ] 6.4 "Initiate Wise Payment" button → confirmation modal showing summary → triggers batch
- [ ] 6.5 Show "SANDBOX MODE" banner on payments pages when sandbox enabled
- [ ] 6.6 Show `PAYMENT_PENDING` status badge on invoice list/detail

## 7. QA

- [ ] 7.1 Run end-to-end test in Wise sandbox: create 3 test invoices → initiate batch → verify PAYMENT_PENDING
- [ ] 7.2 Simulate Wise webhook (sandbox test tool) → verify invoices marked PAID
- [ ] 7.3 Test Mode A and Mode B separately
- [ ] 7.4 Test invalid webhook signature → verify 401 and no state change
