## ADDED Requirements

### Requirement: Admin can close self-service account creation
The system SHALL provide an admin-configurable `registrationOpen` setting (default `true`, changeable at runtime without a deploy) that, when `false`, restricts `POST /api/auth/sign-up/email` to only emails matching an unclaimed pending `Worker.timeDoctorEmail`, or to the very first `User` created (bootstrap).

#### Scenario: Registration open (default)
- **WHEN** `registrationOpen` is `true` and any email signs up
- **THEN** the sign-up succeeds exactly as it does today, regardless of whether the email matches a pending worker

#### Scenario: Registration closed, matched email
- **WHEN** `registrationOpen` is `false` and an email matching an unclaimed `Worker.timeDoctorEmail` signs up
- **THEN** the sign-up succeeds and the pending worker is claimed as normal

#### Scenario: Registration closed, unmatched email
- **WHEN** `registrationOpen` is `false` and an email with no matching unclaimed `Worker` signs up
- **THEN** the sign-up is rejected with a generic error that does not reveal whether the rejection is due to the closed setting or the unmatched email

#### Scenario: First-user bootstrap is never blocked
- **WHEN** `registrationOpen` is `false` and no `User` exists yet
- **THEN** the sign-up succeeds and the created user becomes `ADMIN`, exactly as today

### Requirement: Admin sees pending-worker claim status before closing registration
The Admin Settings page SHALL display the current count of unclaimed pending `Worker` records (`userId IS NULL`) next to the `registrationOpen` toggle.

#### Scenario: Admin views the toggle
- **WHEN** an admin opens the settings page
- **THEN** they see the current `registrationOpen` state and the count of workers still unclaimed
