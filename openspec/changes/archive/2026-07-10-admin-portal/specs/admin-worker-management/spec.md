## ADDED Requirements

### Requirement: Admin worker list
The admin workers page (`/admin/workers`) SHALL list all registered users with Worker records, showing: name, team, email, total invoice count, last submission date. The list SHALL support search by name, email, or team. Default sort is by registration date, newest first.

#### Scenario: Worker list shows correct aggregate data
- **WHEN** an admin views `/admin/workers`
- **THEN** each row shows the worker's invoice count and date of most recent invoice

### Requirement: Worker detail view
The admin worker detail page (`/admin/workers/[id]`) SHALL display the worker's full profile (all Worker fields) and their complete invoice history (same list format as worker dashboard). The admin SHALL NOT be able to edit the worker's profile from this page — only view.

#### Scenario: Admin sees full worker profile
- **WHEN** an admin navigates to `/admin/workers/[id]`
- **THEN** all profile fields (name, address, VAT, payment details) are visible

### Requirement: Admin activate/deactivate worker
From the worker detail page, an admin SHALL be able to toggle the worker's `user.active` field. Deactivating a worker prevents new logins. The current active/inactive status SHALL be clearly displayed with a toggle control.

#### Scenario: Deactivating worker prevents login
- **WHEN** an admin sets a worker to inactive
- **THEN** `user.active` is set to false and the worker cannot log in

#### Scenario: Reactivating worker restores login access
- **WHEN** an admin sets a previously inactive worker back to active
- **THEN** `user.active` is set to true and the worker can log in again
