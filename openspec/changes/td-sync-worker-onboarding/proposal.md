## Why

`Worker.hourlyRate`/`currency` are sourced from Time Doctor's "Payroll summary" CSV export — TD's payroll API is permanently unusable for this (owner-gated, TD support confirmed no read-only grant exists). Any worker not yet covered by a CSV import falls into one of three gaps that produce **zero visibility to Admin today**: (1) a TD-tracked worker with no Portal `Worker` row at all lands as a generic "unmatched" record nobody can act on inline; (2) a self-registered worker who was never CSV-imported defaults to `paymentType: MANUAL` and is silently skipped by the sync *before* the missing-rate check ever runs — no record, no signal, discovered only by manual finance reconciliation; (3) a matched worker missing `hourlyRate`/`currency` does produce a failure record, but it carries no `workerId`, no persisted hours, and the admin UI has no way to fill in the missing data — so even after Admin fixes the rate, that month's invoice is never backfilled. Separately, `GET /api/profile` currently auto-creates a working `Worker` profile for *any* authenticated user, regardless of whether they have any real relationship to the company — the open `/register` form is the intended front door for the ~260 not-yet-claimed CSV-imported workers, but this makes it a front door for anyone.

## What Changes

- `TdMatchFailure` gains `workerId` (nullable), a `reason` enum (`UNMATCHED` / `NEEDS_SETUP` / `MISSING_RATE`), and a persisted hours/quantity snapshot for the billing month — so a failure can be resolved weeks later without re-querying Time Doctor.
- `Worker` gains `paymentConfigured: Boolean @default(false)` — an explicit "an admin has deliberately configured this worker's payment setup" flag, distinct from sitting on schema defaults untouched. The TD sync's `paymentType === "MANUAL"` skip only applies once `paymentConfigured` is `true`; otherwise the worker flows into the new `NEEDS_SETUP` failure instead of being silently dropped. **BREAKING (data)**: requires a backfill migration for ~260 existing worker rows (best-effort: mark configured wherever `hourlyRateUpdatedAt` is set or `paymentType` isn't the default).
- One reusable "create/configure pending worker" function replaces the CSV import's inline row-creation logic and is shared by three entry points: the existing CSV import, a new "resolve TD match failure" action in the admin sync panel (form fields depend on `reason`), and a new standalone "Admin: add worker manually" action for pre-provisioning a new hire mid-month (with their Time Doctor email) so the next TD sync matches and invoices them automatically, without waiting for or redoing a full CSV import. That action always assumes a Time Doctor–tracked worker — `paymentType` is fixed to `TD_PLUS` and the Time Doctor email is required, with no Manual choice offered there (a non-TD Manual worker is configured from the worker's own detail page instead). All three share the CSV import's existing advisory-lock/transaction pattern to prevent duplicate `Worker` rows for the same `timeDoctorEmail` under concurrent creation.
- Resolving a `NEEDS_SETUP`/`MISSING_RATE` failure sweeps and resolves **all** of that worker's other unresolved failures (other billing months), backfilling an invoice for each from its persisted hours snapshot — not just the one clicked. Backfilled invoices carry the historical month's `invoiceDate`/`dueDate`, not today's.
- Quick-create/resolve forms hard-code `vatInclusive: true` (no toggle — matches the sync's existing VAT-inclusive invariant) and use a fixed currency dropdown instead of free text.
- `Worker.timeDoctorEmail` gets a partial unique index (unique among non-null values) and is removed from the worker-editable profile field allowlist — **BREAKING**: workers who could self-edit their TD email via `PUT /api/profile` can no longer do so; it becomes admin-managed only.
- `GET /api/profile` no longer auto-creates a `Worker` for a user with no claimable relationship — **BREAKING**: a `User` with no matching pre-provisioned `Worker` now gets a "not recognized, contact your administrator" state instead of a working profile. Worker-facing pages must handle this state without crashing.
- Slack auto-invite stays unchanged for the CSV import path. The two new worker-creation entry points (resolve-a-failure, manual add-worker) deliberately do **not** auto-invite — Admin notifies the person manually. This is an intentional inconsistency, not an oversight.

## Capabilities

### New Capabilities
(none — this change extends existing TD-sync/worker-onboarding capabilities rather than introducing new ones)

### Modified Capabilities
- `worker-preprovisioning`: adds the shared create/configure-worker function (used by CSV import, failure-resolve, and manual add), the `timeDoctorEmail` uniqueness/ownership change, and the `GET /api/profile` auto-create restriction.
- `timedoctor-sync`: adds `paymentConfigured`-gated skip logic (replacing the unconditional `paymentType === MANUAL` skip), persisted per-failure hours snapshots, and backfill invoice creation on failure resolution.
- `sync-admin-dashboard`: adds the `reason`-typed failure model, per-reason resolve forms (rate/currency/payment-method inputs, currency dropdown), and the manual add-worker action.

## Impact

- **Touches**: Prisma schema + migration (`Worker`, `TdMatchFailure`), `lib/td-sync.ts`, `lib/worker-import.ts`, `app/api/admin/workers/import/route.ts`, `app/api/admin/td-sync/failures/[id]/resolve/route.ts` (rewritten), `app/api/profile/route.ts`, `components/admin/td-sync-panel.tsx`, a new admin add-worker component/route.
- **Does not touch**: Xero sync, Wise integration, n8n, invoice PAID/approval flow, or any TD API rate access (permanently ruled out — see project memory).
- **Non-goals**: no email-sending infrastructure, no shared/default-password onboarding, no live/cached TD roster-membership check, no change to whether `/register` stays open (that's a separate, smaller follow-up change).
