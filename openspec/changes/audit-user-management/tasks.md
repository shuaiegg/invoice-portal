## 1. Database & Core Library

- [x] 1.1 Add `AuditLog` model to schema
- [x] 1.2 Run `prisma migrate dev --name add-audit-log`
- [x] 1.3 Create `lib/audit.ts` — `logInvoiceStatusChanged()` and `logUserRoleChanged()` helpers

## 2. User Role Management

- [ ] 2.1 Create `PATCH /api/admin/users/[id]/role` — validate, protect initial account, update role, write audit log
- [ ] 2.2 Create `/admin/settings/users` page — list all users with role badges and promote/demote buttons

## 3. Audit Log Hooks

- [ ] 3.1 Add `logInvoiceStatusChanged()` to `PATCH /api/admin/invoices/[id]` (single invoice status change)
- [ ] 3.2 Add `logInvoiceStatusChanged()` to `POST /api/admin/invoices/bulk-status` (one entry per invoice, `bulk: true`)

## 4. Audit Log UI

- [ ] 4.1 Create `GET /api/admin/audit` — paginated list, newest first, optional `entityType` filter
- [ ] 4.2 Create `/admin/audit` page — read-only table with action, actor, entity, details, timestamp
- [ ] 4.3 Add "Audit Log" link to admin navigation
