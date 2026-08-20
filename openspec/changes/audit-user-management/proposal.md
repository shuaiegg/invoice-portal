## Problem

Finance admins need to:
1. Grant/revoke admin access to specific user accounts via UI (currently only possible by editing the DB directly)
2. See a traceable history of who changed invoice statuses and who promoted/demoted users

## Solution

### User Role Management
- `/admin/settings/users` page listing all registered users with their roles
- Promote/demote button per user (any admin can operate on others; initial account is permanently protected)
- Admin cannot change their own role

### Audit Log
- `AuditLog` DB table — append-only, never deleted
- Tracks: invoice status changes (admin-initiated only) and user role changes
- `/admin/audit` read-only page showing log entries newest-first

## Decisions

- **Initial account protected**: The user with the earliest `createdAt` is permanently ADMIN and cannot be demoted. Identified at runtime — no schema flag needed.
- **Actor name denormalized**: `actorName` stored on each log entry so records remain readable even if the user is later deleted.
- **Worker-submitted actions not logged**: Only admin-initiated invoice status changes are recorded (APPROVED, PAID, VOID). Worker SUBMIT/REVOKE are not tracked.
- **Bulk status changes logged individually**: Each invoice in a bulk operation gets its own AuditLog entry (details includes `bulk: true` flag).
- **Retroactive data**: Not possible — audit log only covers events from implementation date forward.
