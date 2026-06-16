## 1. Admin API Authorization Middleware

- [ ] 1.1 Create `lib/admin-guard.ts` — helper `requireAdmin(request)` that reads BetterAuth session and returns 403 if missing or role !== ADMIN; used at the top of all admin route handlers

## 2. Admin Dashboard

- [ ] 2.1 Create `app/api/admin/stats/route.ts` — GET: compute 4 stats (invoices this month, pending count, paid amount this month, active worker count) via Prisma aggregates; call `requireAdmin`
- [ ] 2.2 Create `app/api/admin/activity/route.ts` — GET: return 10 most recent Invoice records with worker name; call `requireAdmin`
- [ ] 2.3 Update `app/(admin)/admin/page.tsx` — Server Component: fetch stats + activity, render stats cards grid + activity feed
- [ ] 2.4 Create `components/admin/stats-card.tsx` — Card with title, value, optional subtitle
- [ ] 2.5 Create `components/admin/activity-feed.tsx` — list of recent invoice rows (worker name, invoice #, period, amount, time ago)

## 3. Admin Invoice List & Filters

- [ ] 3.1 Create `app/api/admin/invoices/route.ts` — GET: accept query params (status, period, workerName, team, page, sortBy, sortDir); apply Prisma where clauses; return paginated results with total count; call `requireAdmin`
- [ ] 3.2 Update `app/(admin)/admin/invoices/page.tsx` — Server Component: read searchParams, fetch invoices, render `AdminInvoiceList` with filters
- [ ] 3.3 Create `components/admin/invoice-filters.tsx` — 'use client': status multi-select, period text input, worker name search, team select; updates URL params on change (no full reload)
- [ ] 3.4 Create `components/admin/admin-invoice-table.tsx` — table with Invoice #, Worker, Team, Period, Amount, StatusBadge, Date, Xero sync indicator (synced/pending/failed based on 30-min threshold); checkboxes for bulk select
- [ ] 3.5 Add Xero sync failure badge logic: `xeroSynced === false && createdAt < now - 30min` → show "Sync Failed" badge

## 4. Invoice Status Management

- [ ] 4.1 Create `app/api/admin/invoices/[id]/route.ts` — GET returns full invoice + worker; PUT updates status (validate transition: SUBMITTED→APPROVED, APPROVED→PAID, any→VOID only); call `requireAdmin`
- [ ] 4.2 Update `app/(admin)/admin/invoices/[id]/page.tsx` — Server Component: `await params`, fetch invoice, render `AdminInvoiceDetail`
- [ ] 4.3 Create `components/admin/admin-invoice-detail.tsx` — 'use client': displays all invoice fields, status dropdown with valid transitions, save button, Xero sync status section
- [ ] 4.4 Verify: attempt PAID → SUBMITTED via API → confirm 400 response

## 5. Bulk Status Update

- [ ] 5.1 Create `app/api/admin/invoices/bulk-status/route.ts` — POST: accept `{ invoiceIds: string[], status: 'PAID' }`; only allows APPROVED→PAID; uses `updateMany` with status guard; call `requireAdmin`
- [ ] 5.2 Add "Mark as Paid" bulk action button to `AdminInvoiceTable` — appears when ≥1 checkbox selected; confirmation dialog before submitting
- [ ] 5.3 Verify: select 3 APPROVED invoices → mark as paid → all 3 show PAID status

## 6. CSV Export

- [ ] 6.1 Create `app/api/admin/invoices/export/route.ts` — GET: accept same filter params as invoice list; query all matching invoices (no pagination); generate CSV string with UTF-8 BOM; return with `Content-Type: text/csv` and `Content-Disposition: attachment`; call `requireAdmin`
- [ ] 6.2 CSV columns: Invoice Number, Worker Name, Team, Period, Description, Quantity, Rate, Net Amount, VAT Amount, Total Amount, Status, Invoice Date, Xero Synced
- [ ] 6.3 Add "Export CSV" button to invoice list page — links to `/api/admin/invoices/export` with current filter params
- [ ] 6.4 Verify: download CSV → open in Excel → confirm UTF-8 characters display correctly, amounts are numeric

## 7. Worker Management

- [ ] 7.1 Create `app/api/admin/workers/route.ts` — GET: return all users with Worker records, include invoice count and last submission date; accept `?search=` param for name/email/team filter; call `requireAdmin`
- [ ] 7.2 Update `app/(admin)/admin/workers/page.tsx` — Server Component: fetch workers list, render `AdminWorkerList`
- [ ] 7.3 Create `components/admin/admin-worker-list.tsx` — table: Name, Team, Email, Invoice Count, Last Submission, Active status; search input updates URL param; click row navigates to worker detail
- [ ] 7.4 Create `app/api/admin/workers/[id]/route.ts` — GET returns Worker + User + all invoices; PUT updates `user.active`; call `requireAdmin`
- [ ] 7.5 Update `app/(admin)/admin/workers/[id]/page.tsx` — Server Component: `await params`, fetch worker, render `AdminWorkerDetail`
- [ ] 7.6 Create `components/admin/admin-worker-detail.tsx` — worker profile fields (read-only), active/inactive toggle, invoice history table (reuse invoice table component)
- [ ] 7.7 Verify: deactivate a worker → try logging in as that worker → confirm login fails

## 8. Final Verification

- [ ] 8.1 Log in as WORKER → attempt GET `/api/admin/invoices` → confirm 403
- [ ] 8.2 Log in as ADMIN → confirm all admin pages load correctly
- [ ] 8.3 Full admin flow: view dashboard stats → filter invoices → update status → bulk mark as paid → export CSV → view worker → deactivate worker
- [ ] 8.4 Run `npm run build` — zero TypeScript errors
