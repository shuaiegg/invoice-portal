## ADDED Requirements

### Requirement: Admin can import TD's "Payroll summary" CSV
The admin SHALL be able to upload TD's "Payroll summary" export (columns: `Name, Email, Total hours, ..., Currency, Adjustment, Hourly rate, Total pay, Payment method`) to bulk-create or update `Worker` records, matched by email against `Worker.timeDoctorEmail`.

#### Scenario: Import creates a pending worker
- **WHEN** the CSV contains a row for an email with no matching `Worker`
- **THEN** a new `Worker` is created with `userId: null`, `hourlyRate` from the row, `hourlyRateSource: TD_IMPORT`

#### Scenario: Import maps payment method
- **WHEN** a row's `Payment method` is `Wise` or `PayPal`
- **THEN** the matched worker's payment account type is set to `WISE` or `PAYPAL` respectively

#### Scenario: Import flags Manual payment method for review
- **WHEN** a row's `Payment method` is `Manual`
- **THEN** no `PaymentAccountType` is auto-assigned; the worker is flagged for Finance to confirm the actual payment rail

### Requirement: Import sets invoice-automation level (`Worker.paymentType`) from the payment method column
`Payment method` drives two independent fields: `PaymentAccountType` (which rail — see above) and `Worker.paymentType` (how automated invoice generation is). Wise preserves the pre-Portal fully-automatic workflow; PayPal and Manual both require review before submission, differing only in payment rail.

#### Scenario: Wise gets full automation
- **WHEN** a row's `Payment method` is `Wise`
- **THEN** the matched worker's `paymentType` is set to `TD_ONLY`

#### Scenario: PayPal and Manual both get review-first automation
- **WHEN** a row's `Payment method` is `PayPal` or `Manual`
- **THEN** the matched worker's `paymentType` is set to `TD_PLUS`

#### Scenario: Import never assigns the fully-manual paymentType
- **WHEN** any row is imported, regardless of `Payment method`
- **THEN** the worker's `paymentType` is never set to `MANUAL` — that value is reserved for workers outside TD entirely

### Requirement: Manually-set hourly rates are protected from being silently overwritten by import
Once an admin edits `Worker.hourlyRate` directly (`hourlyRateSource: MANUAL`), a subsequent CSV import SHALL NOT silently overwrite it if the imported value differs from the current value.

#### Scenario: Admin manual edit sets the source flag
- **WHEN** an admin changes a worker's `hourlyRate` from the worker edit screen
- **THEN** `hourlyRateSource` is set to `MANUAL` and `hourlyRateUpdatedAt` is updated

#### Scenario: Import matches a manual edit — reconciled silently
- **WHEN** a CSV import's rate for a `MANUAL`-sourced worker equals the worker's current `hourlyRate`
- **THEN** `hourlyRateSource` resets to `TD_IMPORT`; no conflict is raised

#### Scenario: Import conflicts with a manual edit — flagged for review
- **WHEN** a CSV import's rate for a `MANUAL`-sourced worker differs from the worker's current `hourlyRate`
- **THEN** the worker's `hourlyRate` is left unchanged, and a `WorkerRateConflict` record is created showing both values

#### Scenario: Admin resolves a rate conflict
- **WHEN** an admin reviews a `WorkerRateConflict` and chooses "Use imported value"
- **THEN** `Worker.hourlyRate` is set to the imported value, `hourlyRateSource` resets to `TD_IMPORT`, and the conflict is marked resolved

#### Scenario: Admin keeps the manual value
- **WHEN** an admin reviews a `WorkerRateConflict` and chooses "Keep Portal value"
- **THEN** `Worker.hourlyRate` is unchanged, `hourlyRateSource` stays `MANUAL`, and the conflict is marked resolved (a future import may raise a new conflict if values still differ)

### Requirement: New user registration claims a matching pre-provisioned worker
When a new `User` signs up, the system SHALL look for an unclaimed `Worker` (`userId IS NULL`) whose `timeDoctorEmail` matches the new user's email (case-insensitive) and link it, instead of creating a fresh `Worker` on first profile visit.

#### Scenario: Registration claims a pending worker
- **WHEN** a new user signs up with an email matching an unclaimed `Worker.timeDoctorEmail`
- **THEN** that `Worker.userId` is set to the new user's id; no duplicate `Worker` is created

#### Scenario: Registration with no matching pending worker
- **WHEN** a new user signs up with an email that doesn't match any unclaimed `Worker`
- **THEN** no `Worker` is created at sign-up; the existing lazy-creation-on-first-`/profile`-visit behavior applies

### Requirement: Pre-provisioned workers are invited via Slack
When the import creates a new pending `Worker`, the system SHALL send a Slack notification inviting them to register on the Portal.

#### Scenario: New pending worker is invited
- **WHEN** the CSV import creates a new `Worker` with `userId: null`
- **THEN** a Slack invite notification is sent referencing that worker
