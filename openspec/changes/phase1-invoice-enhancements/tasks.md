## 1. Database Schema

- [x] 1.1 Add `InvoiceLine` model to `prisma/schema.prisma` (id, invoiceId, description, quantity, unitRate, amount, order)
- [x] 1.2 Add `paymentType` enum (`TD_ONLY`, `TD_PLUS`, `MANUAL`) and field to `Worker` model
- [x] 1.3 Add `timeDoctorEmail`, `cryptoCoin`, `cryptoNetwork`, `cryptoWallet`, `paypalEmail` fields to `Worker` model
- [x] 1.4 Make `Invoice.amount` and `Invoice.description` nullable (shadow columns for migration)
- [x] 1.5 Add `Invoice.totalAmount` field (computed-on-write)
- [ ] 1.6 Run `npx prisma migrate dev --name phase1-invoice-line-items`
- [ ] 1.7 Write and run data migration script: convert all existing invoices to single-line `InvoiceLine` records

## 2. API — Invoice Endpoints

- [x] 2.1 Update `POST /api/invoices` to accept `lines[]` array, compute `totalAmount`, create `InvoiceLine` records in transaction
- [x] 2.2 Update `PUT /api/invoices/[id]` to atomically replace all line items (delete + insert in transaction), recompute `totalAmount`
- [x] 2.3 Update `GET /api/invoices` and `GET /api/invoices/[id]` to include `lines[]` in response
- [x] 2.4 Add validation: reject submission with empty or missing `lines`, enforce `quantity > 0`, `description` max 500 chars
- [x] 2.5 Update admin invoice endpoints to include `lines[]` in responses

## 3. API — Worker Profile Endpoint

- [x] 3.1 Update `PUT /api/profile` to accept and save `paymentType`, `timeDoctorEmail`, `cryptoCoin`, `cryptoNetwork`, `cryptoWallet`, `paypalEmail`
- [x] 3.2 Validate `paypalEmail` as email format when present
- [x] 3.3 Update `GET /api/profile` to return all new fields
- [x] 3.4 Update admin worker endpoints to expose `paymentType` and `timeDoctorEmail`; keep crypto/PayPal fields worker-only

## 4. UI — Invoice Form

- [x] 4.1 Replace single amount/description fields with dynamic line-item builder (add/remove rows)
- [x] 4.2 Each row: description input, quantity input, unit rate input, computed amount display (read-only)
- [x] 4.3 Show running total at bottom of line items table
- [x] 4.4 Allow negative unit rates for deductions (display in red)
- [x] 4.5 Update invoice detail page (`/invoice/[id]`) to render line items table
- [x] 4.6 Update PDF print template (`@media print`) to render line items table

## 5. UI — Worker Profile Form

- [x] 5.1 Add PayPal email field to profile payment section
- [x] 5.2 Add crypto fields group (coin, network, wallet) to profile payment section
- [x] 5.3 Add `timeDoctorEmail` field to profile (advanced section or admin-only)

## 6. UI — Admin

- [x] 6.1 Add `paymentType` selector to admin worker edit page (TD Only / TD Plus / Manual)
- [x] 6.2 Show `paymentType` badge in admin worker list table

## 7. Slack Notifications

- [x] 7.1 Add `invoiceSubmitted(invoice, worker)` notification function to `lib/slack.ts`
- [x] 7.2 Add `invoiceStatusChanged(invoice, worker, oldStatus, newStatus)` notification function
- [x] 7.3 Add `invoicePaidWorkerNotification(invoice, worker)` notification function (manual payments only)
- [x] 7.4 Wire `invoiceSubmitted` into `POST /api/invoices` (fire-and-forget, non-blocking)
- [x] 7.5 Wire `invoiceStatusChanged` into admin status-update endpoint
- [x] 7.6 Wire `invoicePaidWorkerNotification` into admin status-update endpoint when status → PAID and worker.paymentType === MANUAL

## 8. Cleanup

- [ ] 8.1 Write follow-up migration to drop legacy `Invoice.amount` and `Invoice.description` nullable columns
- [x] 8.2 Update TypeScript types and Prisma client usage across codebase after schema change
- [ ] 8.3 Manual QA: submit invoice with 3 lines including one deduction, verify total, verify PDF layout
