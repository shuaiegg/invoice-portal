## Context

The portal currently has no UI for role management and no audit trail. Finance needs accountability — knowing who approved what and who has admin access.

## Goals / Non-Goals

**Goals:**
- UI-driven admin role promotion/demotion
- Immutable audit log for invoice status changes and role changes
- Initial account permanently protected from demotion

**Non-Goals:**
- Worker-initiated action logging (submit, revoke)
- Retroactive audit data for past events
- Per-field change tracking (only status/role transitions)
- Log deletion or expiry

## Decisions

**AuditLog is append-only**
No UPDATE or DELETE on AuditLog records. Admin UI has no delete button. API has no DELETE endpoint.

**Initial admin identified by earliest createdAt**
No schema flag needed. At runtime, check if `targetUser.id === firstUser.id` before allowing demotion.

**actorName denormalized on write**
Storing the name at write time means log entries remain interpretable if the actor's account is later removed.

**details is typed JSON per action**
- `INVOICE_STATUS_CHANGED`: `{ invoiceNumber, workerName, from, to, bulk? }`
- `USER_ROLE_CHANGED`: `{ userEmail, userName, from, to }`

## Risks

- **Name changes**: If an admin changes their display name after writing log entries, old entries show the old name. Acceptable — the actorId is always stored for cross-reference.
