## 1. Webhook Dispatch Library

- [x] 1.1 Create `lib/webhook.ts` — export `dispatchWebhook(key: string, payload: object): void` (fire-and-forget, reads WebhookConfig from DB, includes X-Webhook-Secret header if configured, swallows errors)
- [x] 1.2 Write unit test for webhook dispatch logic (mock fetch, verify headers and payload)

## 2. Worker Profile API & Page

- [x] 2.1 Create `app/api/profile/route.ts` — GET returns current worker's profile (creates empty Worker record if none exists); PUT updates Worker record; both require authenticated session
- [x] 2.2 Update `app/(worker)/profile/page.tsx` — Server Component fetches profile, renders `ProfileForm` client component
- [x] 2.3 Create `components/worker/profile-form.tsx` — 'use client', four section groups (Personal Info, Address, Tax, Payment Details), save button, success toast
- [x] 2.4 Wire form to `PUT /api/profile`
- [x] 2.5 Verify: save with name only creates Worker record; update changes existing record

## 3. Invoice Submission API

- [x] 3.1 Create `app/api/invoices/route.ts` — POST handler: validate fields, call `generateInvoiceNumber`, compute amounts (net = qty × rate, vat = net × vatRate/100, total = net + vat), create Invoice record, call `dispatchWebhook('invoice.submitted', payload)`, return `{ invoiceId }`
- [x] 3.2 Ensure invoice date is stored as UTC (parse the DD/MM/YYYY string from form as Paris-timezone date)
- [x] 3.3 Verify: concurrent submissions produce unique invoice numbers (manual test with two simultaneous requests)

## 4. New Invoice Form

- [x] 4.1 Update `app/(worker)/invoice/new/page.tsx` — Server Component: fetch worker profile, if incomplete redirect to `/profile` with a message; otherwise render `NewInvoiceForm`
- [x] 4.2 Create `components/worker/new-invoice-form.tsx` — 'use client', pre-fills profile data, real-time amount calculation (useEffect or derived state on qty/rate/vatRate change), invoice date defaults to today in Europe/Paris timezone
- [x] 4.3 Add form validation: description required, period required, quantity > 0, rate > 0
- [x] 4.4 On submit: POST to `/api/invoices`, redirect to `/invoice/[id]` on success
- [x] 4.5 Verify: submit invoice → check DB → check `invoiceNumber` format `INV-2026-XXXX`

## 5. Invoice Detail & Print

- [x] 5.1 Create `app/api/invoices/[id]/route.ts` — GET returns invoice with worker data; verifies invoice belongs to authenticated worker (or is admin)
- [x] 5.2 Update `app/(worker)/invoice/[id]/page.tsx` — Server Component: `await params`, fetch invoice, render `InvoiceDetail` component
- [x] 5.3 Create `components/worker/invoice-detail.tsx` — 'use client' (for print button), full invoice layout matching PRD template, `@media print` styles hide `.no-print` elements, "Download PDF" button calls `window.print()`
- [x] 5.4 Format dates as DD/MM/YYYY in Europe/Paris timezone using `Intl.DateTimeFormat`
- [x] 5.5 Format amounts as EUR: `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`
- [x] 5.6 Hide VAT row when `vatRate === 0`
- [x] 5.7 Verify: open invoice detail → click print → preview shows only invoice content, no nav

## 6. Worker Dashboard (Invoice History)

- [x] 6.1 Create `app/api/invoices/route.ts` GET — returns paginated list (20/page) of authenticated worker's invoices, sorted by createdAt desc; accepts `?page=` query param
- [x] 6.2 Update `app/(worker)/dashboard/page.tsx` — Server Component: check profile completeness (query Worker record), fetch first page of invoices, render `InvoiceDashboard` client component
- [x] 6.3 Create `components/worker/invoice-dashboard.tsx` — invoice table (Invoice #, Period, Amount, StatusBadge, Date), pagination controls, profile completeness banner if incomplete, EmptyState if no invoices
- [x] 6.4 Verify: dashboard shows correct invoices for logged-in worker only; other workers' invoices not visible

## 7. Invoice Edit

- [x] 7.1 Create `app/api/invoices/[id]/route.ts` PUT — updates Invoice (description, period, serviceDate, invoiceDate, quantity, rate, amounts); only allowed if status is SUBMITTED; dispatch `invoice.updated` webhook; return updated invoice
- [x] 7.2 Add "Edit Invoice" button to `InvoiceDetail` — visible only when `status === 'SUBMITTED'`; navigates to `/invoice/[id]/edit` (or opens modal)
- [x] 7.3 Create `app/(worker)/invoice/[id]/edit/page.tsx` — Server Component: fetch invoice, verify SUBMITTED status (redirect to detail if not), render edit form pre-filled
- [x] 7.4 Reuse `NewInvoiceForm` component with an `initialValues` prop for the edit case
- [x] 7.5 Verify: edit a submitted invoice → DB updated → `invoice.updated` webhook dispatched → redirected to detail with new values → invoice number unchanged

## 8. Verification

- [x] 8.1 Full flow: register → complete profile → submit invoice → view in dashboard → open detail → print
- [x] 8.2 Incomplete profile: register → visit dashboard → confirm banner + disabled New Invoice button
- [x] 8.3 Edit flow: submit invoice → edit it → confirm updated values in DB
- [x] 8.4 Webhook: submit invoice with WebhookConfig disabled → confirm no fetch attempt; enable → confirm fetch is made
- [x] 8.5 Run `npm run build` — zero TypeScript errors
