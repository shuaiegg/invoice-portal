## ADDED Requirements

### Requirement: Admin can promote a user to ADMIN
An admin SHALL be able to promote any WORKER-role user to ADMIN via `/admin/settings/users`. The action is logged in AuditLog.

#### Scenario: Admin promotes a user
- **WHEN** an admin clicks "Make Admin" on a WORKER user
- **THEN** the user's role changes to ADMIN and an AuditLog entry is written

### Requirement: Admin can demote another admin to WORKER
An admin SHALL be able to demote another admin to WORKER, unless that admin is the initial account (earliest createdAt).

#### Scenario: Admin demotes another admin
- **WHEN** an admin clicks "Remove Admin" on another ADMIN user (not the initial account)
- **THEN** the user's role changes to WORKER and an AuditLog entry is written

#### Scenario: Initial account cannot be demoted
- **WHEN** an admin attempts to demote the initial account
- **THEN** the API returns 403 and the UI shows the button as disabled

### Requirement: Admin cannot change their own role
An admin SHALL NOT be able to promote or demote themselves.

#### Scenario: Self-role change blocked
- **WHEN** an admin attempts to change their own role
- **THEN** the API returns 403 and the button is disabled in the UI
