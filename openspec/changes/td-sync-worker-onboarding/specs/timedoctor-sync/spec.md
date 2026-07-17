## ADDED Requirements

### Requirement: Unconfigured matched workers are flagged, not silently skipped
For a matched worker whose `paymentType` is `MANUAL` but `paymentConfigured` is `false` (i.e. still on the schema default, never deliberately set by an admin), the sync SHALL record a `TdMatchFailure` with `reason: NEEDS_SETUP` and the worker's hours for that billing month, instead of skipping the worker with no record.

#### Scenario: Never-configured self-registered worker is TD-tracked this month
- **WHEN** a matched worker has `paymentType: MANUAL`, `paymentConfigured: false`, and TD reports hours for them this month
- **THEN** a `TdMatchFailure` is created with `reason: NEEDS_SETUP`, `workerId` set, and the computed hours stored; no invoice is created yet

#### Scenario: Deliberately configured Manual worker is still skipped silently
- **WHEN** a matched worker has `paymentType: MANUAL` and `paymentConfigured: true`
- **THEN** the sync skips them with no `TdMatchFailure`, as today

### Requirement: Match failures persist the billing-month hours snapshot
Every `TdMatchFailure` (regardless of `reason`) SHALL store the computed hours for that TD user in that billing month at the time the failure is written.

#### Scenario: Failure created with hours
- **WHEN** the sync writes any `TdMatchFailure` for a TD user with `totalSec` seconds tracked that month
- **THEN** the failure record stores the corresponding hours value

### Requirement: Resolving a match failure backfills its invoice using the stored snapshot
When a `TdMatchFailure` with `reason: NEEDS_SETUP` or `MISSING_RATE` is resolved (worker's rate/currency/paymentType configured), the system SHALL immediately create the missing invoice for that failure's billing month using its stored hours snapshot, without re-querying Time Doctor.

#### Scenario: Resolve creates the backfilled invoice
- **WHEN** an admin resolves a `MISSING_RATE` failure by entering rate and currency
- **THEN** an invoice is created for that failure's `billingMonth` using the failure's stored hours, with `invoiceDate`/`dueDate` computed from that historical month (not the resolution date)

#### Scenario: Resolving one failure sweeps the same worker's other unresolved failures
- **WHEN** a worker has multiple unresolved `TdMatchFailure` records across different billing months and an admin resolves any one of them
- **THEN** all of that worker's other unresolved failures are also resolved in the same action, each backfilling its own month's invoice from its own stored snapshot

## MODIFIED Requirements

### Requirement: Matched worker has no hourlyRate set
When a matched, TD-tracked worker is missing `hourlyRate` or `currency`, the sync SHALL record a `TdMatchFailure` with `reason: MISSING_RATE`, `workerId` set, and that billing month's hours stored — rather than a generic failure with the reason embedded in a free-text name field.

#### Scenario: Matched worker has no hourlyRate set
- **WHEN** a matched worker is TD-tracked this month but `Worker.hourlyRate` or `Worker.currency` is null
- **THEN** no invoice is created for them yet; a `TdMatchFailure` is recorded with `reason: MISSING_RATE`, `workerId`, and this month's hours, so Admin can resolve it later without losing the month
