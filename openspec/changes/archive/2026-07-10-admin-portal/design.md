## Context

Workers and integrations are fully functional. This change builds the finance team's operational interface: dashboards, invoice status management, worker account control, and data export. The admin portal is read-heavy with occasional writes (status updates, worker deactivation).

## Goals / Non-Goals

**Goals:**
- Finance team can see all invoice activity and update payment status without touching Xero or a spreadsheet
- Bulk operations for end-of-month payment processing
- CSV export that works in Excel for non-technical users

**Non-Goals:**
- Real-time updates / websockets (page refresh is sufficient for v1)
- Xero integration management (that's in n8n-integration and admin settings from foundation)
- Worker notification on status change (out of scope per exploration decisions)

## Decisions

### D1: All admin API routes enforce role server-side

Every `/api/admin/*` route handler SHALL call BetterAuth's session getter and verify `session.user.role === 'ADMIN'`. This is defense-in-depth: the layout redirect catches UI-level access, but the API must also enforce it independently.

```ts
const session = await auth.api.getSession({ headers: request.headers })
if (!session || session.user.role !== 'ADMIN') return new Response(null, { status: 403 })
```

### D2: Filtering implemented as URL search params

Admin invoice filters (status, period, worker name, team) are passed as URL search params. The Server Component reads them via `searchParams` prop and passes them to Prisma `where` clauses. This makes filtered views bookmarkable and shareable.

```
/admin/invoices?status=SUBMITTED&period=June+2026&worker=Maria
```

### D3: CSV export as a streaming GET endpoint

`GET /api/admin/invoices/export` accepts the same filter params as the list page. Returns `Content-Type: text/csv` with `Content-Disposition: attachment; filename="invoices-2026-06.csv"`. UTF-8 BOM prepended (`﻿`) for Excel compatibility. Amounts as plain numbers.

Implementation: stream rows from Prisma cursor to avoid loading all invoices into memory. For 200 workers × 12 months = ~2400 rows maximum — a simple `findMany` is also fine for v1.

### D4: Xero sync failure detection (30-minute threshold)

An invoice is considered "sync failed" if: `xeroSynced === false` AND `createdAt < now() - 30 minutes`. This logic runs server-side and is passed as a computed field. The 30-minute threshold accounts for n8n processing time and transient failures.

### D5: Bulk status update via a dedicated endpoint

`POST /api/admin/invoices/bulk-status` accepts `{ invoiceIds: string[], status: 'PAID' }`. Only APPROVED → PAID transition is permitted in bulk. Uses Prisma `updateMany` with a `where: { id: { in: invoiceIds }, status: 'APPROVED' }` guard to prevent invalid transitions.

### D6: Stats computed fresh on each page load (no cache)

Admin dashboard stats are computed with 4 Prisma aggregate queries scoped to the current calendar month. No caching for v1 — the data needs to be current. With <2500 total invoices in year 1, these queries complete in <100ms on Neon.

## Risks / Trade-offs

**Admin list performance with many invoices** → Mitigation: Prisma indexes on `status` and `invoiceDate` (already defined in foundation schema). Pagination (20 per page) keeps query result sets small. Acceptable for v1 scale.

**CSV export with full dataset** → Mitigation: for v1 scale (~2400 rows), `findMany` is fine. If scale grows, switch to cursor-based streaming.

**Bulk status update partial failure** → Mitigation: `updateMany` in Prisma is atomic per row but not wrapped in a transaction. If one fails, others may succeed. For v1, this edge case is acceptable — admin can refresh and retry. Can wrap in `$transaction` if needed.

## Migration Plan

1. Build admin stats API and dashboard page
2. Build invoice list with filter params + status transitions
3. Build bulk status update endpoint and UI
4. Add Xero sync failure indicator
5. Build CSV export endpoint and "Export CSV" button
6. Build worker list with search
7. Build worker detail page with invoice history
8. Add worker active/inactive toggle
9. Verify all admin API routes return 403 for WORKER-role sessions
10. Run `npm run build` — zero TypeScript errors
