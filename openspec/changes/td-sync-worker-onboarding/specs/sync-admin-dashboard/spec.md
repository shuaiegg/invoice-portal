## ADDED Requirements

### Requirement: Resolve form adapts to the failure's reason
The admin sync panel SHALL render a different resolve form depending on `TdMatchFailure.reason`: `UNMATCHED` offers "link to an existing worker" (as today) or "create a new worker" (name/rate/currency/channel, pre-filled with the TD name/email — `paymentType` is hardcoded to `TD_PLUS`, not a form choice, since an `UNMATCHED` failure by definition has no prior Portal relationship, the same reasoning as the "Add worker" dialog); `NEEDS_SETUP` offers paymentType + rate/currency/channel for the already-matched worker (a genuine judgment call — this worker already has a Portal account and may have deliberately been Manual); `MISSING_RATE` offers rate/currency only.

#### Scenario: Admin creates a worker from an unmatched failure
- **WHEN** an admin resolves an `UNMATCHED` failure via "create a new worker" and fills in rate/currency/channel
- **THEN** a `Worker` is created via the shared creation function with `paymentType: TD_PLUS`, the failure is resolved, and its backfilled invoice is created

#### Scenario: Admin configures a never-configured worker as Manual
- **WHEN** an admin resolves a `NEEDS_SETUP` failure and explicitly chooses `paymentType: MANUAL`
- **THEN** the worker's `paymentType` is set to `MANUAL` and `paymentConfigured` becomes `true` — the sync will not flag this worker again even if they still show TD hours next month

#### Scenario: Admin fills in a missing rate
- **WHEN** an admin resolves a `MISSING_RATE` failure by entering rate and currency
- **THEN** the worker's `hourlyRate`/`currency` are updated, `paymentConfigured` remains `true`, and the failure resolves with its invoice backfilled

### Requirement: Currency is selected from a fixed list, not free text
Every form that sets `Worker.currency` in the resolve or manual-add flows SHALL present a fixed dropdown of currencies in active use, not a free-text field.

#### Scenario: Admin selects currency
- **WHEN** an admin fills in the resolve or add-worker form
- **THEN** the currency field is a dropdown, not a text input

### Requirement: Resolve and add-worker forms do not expose a VAT-inclusive toggle
Invoices created via failure resolution or manual worker addition SHALL always be computed as VAT-inclusive, matching the sync's existing invariant, with no UI control to change this.

#### Scenario: Backfilled invoice VAT calculation
- **WHEN** an invoice is created via failure resolution
- **THEN** its VAT amount is computed as VAT-inclusive of the gross total, with no admin-facing option to compute it otherwise

## MODIFIED Requirements

### Requirement: Admin can resolve match failures
For each `TdMatchFailure` in the review queue, the admin SHALL be able to resolve it using the form appropriate to its `reason` (see "Resolve form adapts to the failure's reason"), dismiss it, or permanently ignore the underlying TD email — dismiss and ignore behave as today.

#### Scenario: Admin links unmatched user to an existing worker
- **WHEN** an admin selects an existing Portal worker from a dropdown for an `UNMATCHED` failure and saves
- **THEN** `Worker.timeDoctorEmail` is set to the TD user's email and the failure is resolved

#### Scenario: Admin dismisses a failure
- **WHEN** an admin dismisses any failure regardless of reason
- **THEN** the failure is marked resolved with no worker or invoice changes, as today
