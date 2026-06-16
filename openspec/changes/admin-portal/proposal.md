## Why

Finance team (Nataly, Lorena) and management need a central dashboard to track invoice activity, manage worker accounts, update payment statuses, and monitor Xero sync health. This change builds the complete admin-facing portal: dashboard overview, full invoice management with status transitions, worker account management, CSV export, and Xero sync status visibility.

## What Changes

- Admin dashboard: stats cards (invoices this month, pending approval count, paid amount this month, active workers), recent activity feed
- Invoice management: full list with filters (team, status, period, worker name search), sort by date/amount/status, per-invoice status transition (SUBMITTED→APPROVED→PAID), Xero sync status indicator
- Bulk status update: select multiple APPROVED invoices → Mark as Paid
- CSV export: all invoices for a selected period exported with all fields
- Worker management: list all workers (name, team, email, invoice count, last submission), toggle active/inactive, view worker profile + full invoice history
- Xero sync failure display: invoices where `xeroSynced: false` after creation are flagged for manual attention

## Capabilities

### New Capabilities

- `admin-dashboard`: Overview page with aggregate stats and recent activity. Stats computed server-side on each page load (no caching for v1). Covers current calendar month by default.
- `admin-invoice-management`: Full invoice list with multi-dimensional filtering and sorting. Individual invoice status transitions with confirmation. Bulk "Mark as Paid" for selected invoices. Xero sync status shown per invoice (synced / failed / pending).
- `admin-worker-management`: Worker list with search. Per-worker profile view and invoice history. Admin can toggle `user.active` — deactivated users cannot log in.
- `csv-export`: Server-side CSV generation for invoices. Columns: Invoice #, Worker Name, Team, Period, Description, Quantity, Rate, Net Amount, VAT Amount, Total Amount, Status, Invoice Date, Xero Synced. UTF-8 encoded with BOM for Excel compatibility.

### Modified Capabilities

## Impact

- **New API routes**: `GET /api/admin/invoices`, `PUT /api/admin/invoices/[id]` (status update), `POST /api/admin/invoices/bulk-status`, `GET /api/admin/invoices/export` (CSV), `GET /api/admin/workers`, `PUT /api/admin/workers/[id]` (active toggle), `GET /api/admin/workers/[id]`
- **Modified pages**: `/admin` (stats), `/admin/invoices`, `/admin/invoices/[id]`, `/admin/workers`, `/admin/workers/[id]`
- **All admin API routes** enforce `role: ADMIN` server-side (not just layout redirect)
- **No n8n or Xero API calls** — admin manages status in the portal only; Xero remains Nataly's domain
