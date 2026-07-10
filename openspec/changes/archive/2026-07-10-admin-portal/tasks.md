## 1. Admin API Authorization Middleware

- [x] 1.1 Create `lib/admin-guard.ts` — helper `requireAdmin(request)` that reads BetterAuth session and returns 403 if missing or role !== ADMIN; used at the top of all admin route handlers
- [x] 1.2 Verify: visit any admin page as a WORKER role user → confirm layout redirect or 403 response

## 2. Admin Dashboard Overview

- [x] 2.1 Create `app/api/admin/stats/route.ts` — computes current month stats: total invoices, pending approval, paid amount (sum), active worker count
- [x] 2.2 Create `app/api/admin/activity/route.ts` — returns 10 most recent invoice submissions across all workers
- [x] 2.3 Update `app/(admin)/admin/page.tsx` — Server Component fetches stats and activity; renders overview
- [x] 2.4 Create `components/admin/stats-card.tsx` — simple card showing title, value, and optional icon/trend
- [x] 2.5 Create `components/admin/activity-feed.tsx` — vertical list of recent submissions with status badges and relative time (using `date-fns`)
- [x] 2.6 Update `app/(admin)/admin/settings/page.tsx` — interface for managing `WebhookConfig` records
- [x] 2.7 Create `components/admin/webhook-settings.tsx` — table of configurations with "Configure" buttons opening a dialog for URL and secret editing

## 3. Admin Invoice List & Filters

- [x] 3.1 Create `app/api/admin/invoices/route.ts` GET — returns paginated invoices (20/page); supports filters: status (multi), period, workerName, team
- [x] 3.2 Update `app/(admin)/admin/invoices/page.tsx` — Server Component: parse searchParams, fetch invoices, render filter bar and table
- [x] 3.3 Create `components/admin/invoice-filters.tsx` — 'use client' form with inputs for name, team, period, and multi-select for status; updates URL searchParams on change
- [x] 3.4 Create `components/admin/admin-invoice-table.tsx` — enhanced invoice table with bulk-selection checkboxes and "Xero Sync" column (shows Synced/Failed/Pending badge)
- [x] 3.5 Add "Sync Status" logic to table: if `xeroSynced` is false and `createdAt` > 30m ago, show "Sync Failed" warning

## 4. Invoice Status Management

- [x] 4.1 Create `app/api/admin/invoices/[id]/route.ts` PUT — handler to update status (SUBMITTED → APPROVED → PAID or Any → VOID); validates allowed transitions
- [x] 4.2 Update `app/(admin)/admin/invoices/[id]/page.tsx` — Server Component: fetch invoice with worker and user details; render admin-specific detail view
- [x] 4.3 Create `components/admin/admin-invoice-detail.tsx` — 'use client'; shows all invoice details, worker info, payment details, and a "Manage Status" sidebar/section
- [x] 4.4 Add "Approve Invoice" and "Mark as Paid" buttons in detail view; trigger status update with success toast

## 5. Bulk Status Update

- [x] 5.1 Create `app/api/admin/invoices/bulk-status/route.ts` POST — accepts `{ invoiceIds: string[], status: 'PAID' }`; updates all selected APPROVED invoices to PAID in one transaction
- [x] 5.2 Update `AdminInvoiceTable` to show "Bulk Actions" bar when rows are selected; add "Mark as Paid" button
- [x] 5.3 Verify: select 3 APPROVED invoices → click bulk paid → confirm all updated to PAID in DB and list refreshes

## 6. CSV Export

- [x] 6.1 Create `app/api/admin/invoices/export/route.ts` — GET handler: apply current filters from query params, generate CSV with UTF-8 BOM, return as downloadable file
- [x] 6.2 Columns: Invoice Number, Worker Name, Team, Period, Description, Quantity, Rate, Net, VAT, Total, Status, Invoice Date, Xero Synced
- [x] 6.3 Add "Export CSV" button to `app/(admin)/admin/invoices/page.tsx` header (next to PageHeader title)

## 7. Worker Management

- [x] 7.1 Create `app/api/admin/workers/route.ts` — GET returns list of all workers with invoice counts and last submission dates; supports search
- [x] 7.2 Update `app/(admin)/admin/workers/page.tsx` — Server Component: fetch worker list, render search and table
- [x] 7.3 Create `components/admin/admin-worker-list.tsx` — table showing name, team, email, total invoices, last submission, and "Active" status toggle
- [x] 7.4 Create `app/api/admin/workers/[id]/route.ts` PUT — handler to toggle `user.active` status (deactivates login)
- [x] 7.5 Update `app/(admin)/admin/workers/[id]/page.tsx` — Server Component: fetch worker profile and full invoice history
- [x] 7.6 Create `components/admin/admin-worker-detail.tsx` — profile overview, contact details, and reuse invoice table component for full history

## 8. Final Polish & Verification

- [x] 8.1 Register a new worker → complete profile → submit invoice → visit admin portal → confirm new invoice appears in Activity Feed and Invoices list
- [x] 8.2 Verify role protection: log in as worker → attempt to visit `/admin` → confirm redirected; attempt to fetch `/api/admin/stats` → confirm 403
- [x] 8.3 Full admin flow: view dashboard stats → filter invoices → update status → bulk mark as paid → export CSV → view worker → deactivate worker
- [x] 8.4 Run `npm run build` — zero TypeScript errors
