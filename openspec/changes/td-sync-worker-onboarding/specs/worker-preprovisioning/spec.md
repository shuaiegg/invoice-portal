## ADDED Requirements

### Requirement: One shared function creates and configures pending workers
The system SHALL expose a single function for creating or configuring a pending `Worker` (rate, currency, `paymentType`, payment account), used by every entry point that can create one: CSV import, TD sync failure resolution, and manual admin worker creation. Every entry point SHALL hold the same advisory lock and row-locking behavior the CSV import uses today, so concurrent creations for the same `timeDoctorEmail` cannot both succeed.

#### Scenario: Two creation paths race on the same email
- **WHEN** a CSV import and an admin's "resolve failure" action both attempt to create a `Worker` for the same `timeDoctorEmail` at the same time
- **THEN** exactly one `Worker` row is created; the second attempt finds and updates the first instead of creating a duplicate

#### Scenario: Worker creation sets paymentConfigured
- **WHEN** any of the three entry points creates or configures a worker's payment setup
- **THEN** `Worker.paymentConfigured` is set to `true`

### Requirement: Admin can manually add a worker ahead of the next CSV import
The admin SHALL be able to create a `Worker` record directly (name, rate, currency, payment account) without a full CSV re-import — to pre-provision a new hire's `timeDoctorEmail` so the next TD sync matches and invoices them automatically, using the same shared creation function as CSV import and failure resolution. This flow always assumes the worker is Time Doctor–tracked: `paymentType` is hardcoded to `TD_PLUS` (not a choice) and `timeDoctorEmail` is required. There is no Manual option here — a genuinely non-TD, self-reporting worker is configured from the worker's own detail page instead, to avoid the automation-level choice being offered somewhere it can confuse Finance (user direction 2026-07-17).

#### Scenario: Admin adds a worker ahead of next month's TD sync
- **WHEN** an admin uses "Add worker" and provides the new hire's name, rate, currency, and Time Doctor email
- **THEN** a `Worker` is created with `userId: null`, `paymentType: TD_PLUS`, `paymentConfigured: true`, and no Slack invite is sent automatically; the next TD sync matches them by that email and generates their draft invoice normally

#### Scenario: Time Doctor email is required
- **WHEN** an admin uses "Add worker" but leaves the Time Doctor email blank
- **THEN** the request is rejected — this worker would otherwise never be matched by any future sync

### Requirement: `Worker.timeDoctorEmail` is admin-managed and unique
`Worker.timeDoctorEmail` SHALL NOT be editable by the worker themselves (removed from `PUT /api/profile`'s editable fields) and SHALL be unique among non-null values at the database level.

#### Scenario: Worker attempts to change their TD email
- **WHEN** a worker submits a profile update including `timeDoctorEmail`
- **THEN** the field is ignored; the update succeeds for all other fields

#### Scenario: Duplicate TD email rejected
- **WHEN** any code path attempts to set two different `Worker` rows to the same non-null `timeDoctorEmail`
- **THEN** the database rejects the second write

## MODIFIED Requirements

### Requirement: New user registration claims a matching pre-provisioned worker
When a new `User` signs up, the system SHALL look for an unclaimed `Worker` (`userId IS NULL`) whose `timeDoctorEmail` matches the new user's email (case-insensitive) and link it. If no match exists, the system SHALL NOT create a `Worker` at any point for that user — including on first `/profile` visit.

#### Scenario: Registration claims a pending worker
- **WHEN** a new user signs up with an email matching an unclaimed `Worker.timeDoctorEmail`
- **THEN** that `Worker.userId` is set to the new user's id; no duplicate `Worker` is created

#### Scenario: Registration with no matching pending worker
- **WHEN** a new user signs up with an email that doesn't match any unclaimed `Worker`
- **THEN** no `Worker` is created at sign-up

#### Scenario: Profile access with no claimed worker
- **WHEN** a signed-in user with no matching `Worker` (from either sign-up or any prior claim) visits `/profile` or any worker-facing page
- **THEN** the system returns a "not recognized — contact your administrator" state instead of creating a `Worker`; the page renders that state without erroring
