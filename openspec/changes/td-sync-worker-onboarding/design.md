## Context

Today, `Worker.hourlyRate`/`currency`/`paymentType` are populated exactly one way: an admin uploads Time Doctor's "Payroll summary" CSV export (`app/api/admin/workers/import/route.ts`). This is a bulk, point-in-time operation. Between imports, three categories of worker slip through with no admin-visible signal:

1. **Unmatched**: a TD user with no `Worker` row at all. Already produces a generic `TdMatchFailure`, but the admin UI (`components/admin/td-sync-panel.tsx`) only offers Link/Dismiss/Ignore against *existing* workers — there's no way to create one inline.
2. **Never configured**: a worker who self-registered (`GET /api/profile`'s skeleton-create path) but was never touched by a CSV import or an admin. `Worker.paymentType` sits on its schema default `MANUAL`, and `lib/td-sync.ts`'s `if (activeWorker.paymentType === "MANUAL") continue;` (line 74) skips them *before* the missing-rate check on the next line ever runs. No `TdMatchFailure` is written. This is indistinguishable, in the data, from a worker an admin *deliberately* set to `MANUAL` (self-reported, no TD sync wanted) — both have `paymentType: MANUAL` and (usually) `hourlyRate: null`, because a true Manual worker types their own line items on every invoice and never needs `Worker.hourlyRate` at all.
3. **Missing rate**: a matched, TD-tracked worker where `hourlyRate` or `currency` is null. Already produces a `TdMatchFailure` (reason embedded as a string suffix on `tdName`), but the record has no `workerId`, no persisted hours, and the resolve UI has no rate/currency input — so fixing the worker's rate afterward doesn't recover the missed month's invoice.

Separately, `GET /api/profile` (`app/api/profile/route.ts:24-33`) auto-creates a `Worker` row for *any* authenticated `User`, with no check that the email has any real relationship to the company. This is the actual security-relevant gap: the intended front door (self-registration matched by `timeDoctorEmail`, via `claimPreprovisionedWorker`) is fine, but the fallback silently gives a working profile to anyone who registers with an unrelated email.

This change makes all three gaps visible and actionable in one place (the TD sync failure queue), and closes the profile auto-vivification gap, without adding any new external dependency (no email sending, no TD payroll-API access — both previously ruled out, see project memory `project_timedoctor_api_findings`).

A related, smaller change — closing the open `/register` form once the ~260 pending CSV-imported workers finish claiming their accounts — is deliberately **out of scope** here; it's independent and lower-risk once this change's `GET /api/profile` fix ships (that fix is the load-bearing part; closing `/register` is optional hardening on top).

## Goals / Non-Goals

**Goals:**
- Every TD-tracked worker who can't get an automatic invoice this month produces exactly one actionable, typed failure record admin can resolve from the sync panel.
- Resolving a failure never loses data: it uses hours captured at sync time, not a live re-query, and it backfills every unresolved month for that worker, not just the clicked one.
- Worker creation — whether via CSV import, failure resolution, or manual admin add — is a single code path with one locking strategy, so duplicate/split-identity `Worker` rows can't be created by two of these racing each other (or racing a real self-registration).
- `GET /api/profile` never grants a working profile to a `User` with no legitimate claim.

**Non-Goals:**
- No TD payroll-API integration (permanently ruled out — owner-gated, TD support confirmed no read-only grant is possible).
- No email-sending infrastructure or shared/default-password onboarding.
- No live or cached TD company-roster membership check anywhere (would add an external-API dependency to the auth-critical path).
- No change to whether `/register` stays open — tracked as a separate follow-up.
- No change to Xero sync, Wise integration, or the invoice APPROVED→PAID flow.

## Integration Boundary

This change touches Time Doctor only (Portal already owns this integration directly — `lib/timedoctor.ts`, `lib/td-sync.ts` — polling/scheduled via `GET /api/cron/td-sync`, never webhook-driven). It does not introduce any new external call: the persisted-hours-snapshot design specifically *avoids* adding a live re-query to TD for historical months. n8n involvement stays exactly as today — notification-only, no changes to Slack/email fan-out logic beyond what's already described (CSV-import Slack invite unchanged; the two new worker-creation paths intentionally send no automated notification at all, admin-only manual outreach). No Xero or Wise surface is touched.

## Decisions

### D1 — `TdMatchFailure.reason` as a typed enum, not a string suffix
Today "missing rate" is signaled by appending `" (missing rate or currency)"` to `tdName` — unparseable, and the UI can't branch on it. Replacing with `reason: UNMATCHED | NEEDS_SETUP | MISSING_RATE` lets the resolve UI render the right form per reason. `workerId` becomes nullable-but-present: null only for `UNMATCHED` (no `Worker` row exists yet); set for the other two.

Alternative considered: keep failures generic and drive everything off looking up the worker's current state at resolve time. Rejected — that reintroduces the "missing hours snapshot" problem (see D2) and can't distinguish "this worker still needs setup" from "this worker was fixed after the failure was written but before it was resolved," which would misrender the form.

### D2 — Persist the billing-month hours snapshot on the failure record, not a live re-query
`TdMatchFailure` gains a quantity/seconds field, populated from the same `fetchMonthlyHours` result already fetched during the sync run that created the failure. Resolving weeks later uses this stored value.

Alternative considered: re-call `fetchMonthlyHours(year, month)` at resolve time. Rejected — TD's stats endpoint reflects *current* tracked time, which can silently drift from what was true when the sync ran (edited time entries, corrections), producing an invoice inconsistent with what every other worker in that month's run was paid on. A snapshot is also strictly simpler: no new external call on the admin's critical path, no new failure mode (TD unreachable at resolve time) to handle.

### D3 — `paymentConfigured: Boolean` instead of a new `PaymentType` enum value
The real distinguishing signal needed is "has anyone deliberately decided this worker's payment setup" vs. "still sitting on whatever Prisma defaulted it to." Modeling this as a new `paymentType: UNCONFIGURED` enum value was considered and rejected: every comparison site (`td-sync.ts`, `admin-worker-detail.tsx`'s select, CSV import) would need a third branch, and — more importantly — a worker legitimately configured as `MANUAL` by an admin who chose not to set a rate (because Manual workers don't need one) would need a *second* signal anyway to distinguish "admin chose Manual" from "still unconfigured," collapsing back to needing a boolean regardless. A dedicated boolean is additive: no existing `paymentType === "..."` comparison changes shape, and it's set at exactly three call sites (CSV import, the payment section of the admin worker-detail save, and the new shared worker-creation function).

### D4 — One shared "create/configure pending worker" function across CSV import, failure-resolve, and manual add
The CSV import already solved worker-creation correctness once: advisory lock (`pg_try_advisory_xact_lock(hashtext('worker-import'))`) held for the transaction, batched existing-worker lookup, `FOR UPDATE` row locks on matched rows, `PaymentAccount` creation on Wise/PayPal. Extracting this into a function reused by all three creation paths (rather than writing the failure-resolve and manual-add paths independently) means the concurrency protection is inherited automatically instead of needing to be re-derived and re-verified for two more code paths. This is the direct mitigation for the race in R1 below.

### D5 — Sweep all of a worker's unresolved failures on resolve, keyed by `workerId` (falling back to normalized `tdEmail` for `UNMATCHED` failures pre-dating the worker's creation)
If a worker sits unconfigured across several sync cycles, each cycle writes its own failure with its own hours snapshot. Resolving must process every one of them in a single action — filling in rate/currency once and looping the stored snapshots to backfill an invoice per month — or admin has to repeat the same data entry per month, and it's easy to fix the "current" one while earlier months quietly stay unresolved forever.

### D6 — `Worker.timeDoctorEmail` becomes admin-managed only; partial unique index added
Removing worker self-edit access (from `PUT /api/profile`'s allowlist) closes the most direct route to identity collision (a worker editing their own record to claim someone else's TD email). The partial unique index (`UNIQUE (timeDoctorEmail) WHERE timeDoctorEmail IS NOT NULL` — Postgres allows multiple `NULL`s under a unique index, so unclaimed/no-TD-email workers are unaffected) is the DB-level backstop for every other path (D4's shared function, plus any future one), catching what code-level locking might miss rather than relying on locking discipline being followed correctly everywhere, forever.

### D7 — `GET /api/profile` stops auto-vivifying; relies on the existing `after:create` claim hook having already run
`claimPreprovisionedWorker` already runs at sign-up (`lib/auth.ts`'s `after: create` hook) and links a matching pending `Worker` via `userId`. If `GET /api/profile` finds no `Worker` for the session's `userId`, that means the hook already tried and found nothing — there is no legitimate claim to auto-create. Returning a "not recognized" state instead of silently creating a `Worker` is the actual fix for open-registration risk; it doesn't require closing `/register` itself (kept open, deliberately, for the separate follow-up change).

## State Machine — `TdMatchFailure` resolution

```
                 sync run finds a problem
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   UNMATCHED         NEEDS_SETUP       MISSING_RATE
 (no Worker row)   (Worker row exists  (Worker row exists,
                    paymentConfigured   paymentConfigured=true,
                    = false)            rate/currency null)
        │                 │                 │
        │   admin fills form (rate, currency, paymentType,
        │   Wise/PayPal/Manual account details as applicable)
        └─────────────────┼─────────────────┘
                           ▼
              shared create/configure-worker fn
              (creates Worker if UNMATCHED, else
               updates it; sets paymentConfigured=true)
                           ▼
         sweep this worker's other unresolved failures
                           ▼
        for each (this + swept) failure's stored snapshot:
              create/backfill one Invoice, mark resolved
```

Every failure ends in exactly one of: `resolved` (via the flow above), `dismissed` (admin decides no action needed — status quo, unchanged from today), or `ignored` (permanent, `TdIgnoredEmail` — unchanged from today, e.g. the company owner's own TD account).

## Idempotency & Failure Handling

- **Duplicate invoice creation**: backstopped by the existing `@@unique([workerId, billingMonth, supplementNo])` on `Invoice` — a resolve action racing a fresh sync run (or a double-submit of the resolve form) hits `P2002`, caught and treated as "already exists," matching `runTdSync`'s existing pattern (`lib/td-sync.ts:132-135`).
- **Duplicate worker creation**: backstopped by D4 (shared advisory lock) and D6 (partial unique index) — belt and suspenders, since the lock covers the common case and the index covers anything that reaches the DB despite it.
- **Partial resolve failure** (e.g., DB drops mid-sweep after 2 of 4 months backfilled): the resolve action runs inside one transaction covering the worker update, the failure sweep, and all backfilled invoices — either all of it commits or none of it does; a retried resolve picks up exactly where it left off since nothing partial was persisted.
- **Audit trail**: `Worker.hourlyRateUpdatedBy`/`hourlyRateUpdatedAt` (existing fields) are set by the shared worker-creation function exactly as they are today by the admin worker-detail PUT, so a rate set via failure-resolve is indistinguishable in the audit trail from one set via the existing manual-edit screen.

## Risks / Trade-offs

- **R1 — Race between a resolve action and a concurrent self-registration.** Admin resolves an `UNMATCHED` failure for someone at the same moment that person happens to self-register. Mitigated by D4: the shared function's advisory lock is the same one `claimPreprovisionedWorker`'s creation path would need to respect too — **this requires auditing `claimPreprovisionedWorker`/the sign-up hook to either take the same lock or be proven race-free against it as an implementation task**, not just the three creation entry points against each other.
- **R2 — One-time false positive in the `paymentConfigured` backfill migration.** A worker an admin deliberately set to `MANUAL` without ever touching `hourlyRate` (legitimately not needed) will be swept into `paymentConfigured = false` by the backfill heuristic (`hourlyRateUpdatedAt IS NOT NULL OR paymentType != 'MANUAL'`), since neither condition is true for them. → They'll surface once as a `NEEDS_SETUP` failure; admin dismisses or confirms Manual once, and `paymentConfigured` is set going forward. Accepted as a low-cost, one-time false positive — the alternative (a more precise heuristic) isn't reliably derivable from existing data.
- **R3 — Currency/VAT entered by hand in the resolve/manual-add forms carries more risk than CSV-sourced data**, since it feeds Xero bills directly. Mitigated by fixed currency dropdown (not free text) and hard-coded `vatInclusive: true` (no toggle) — see proposal. VAT *rate* itself is still admin-entered free-form (as it already is on the existing worker-detail screen); not changed by this proposal.
- **R4 — Backfilled invoices break chronological invoice-number ordering** (a March invoice created in July gets whatever number is current in July). Accepted — already true today for late worker-submitted invoices and supplement invoices; not a new failure mode.

## Migration Plan

1. Prisma migration: add `TdMatchFailure.workerId` (nullable FK), `reason` enum, hours-snapshot column; add `Worker.paymentConfigured` (default `false`); add partial unique index on `Worker.timeDoctorEmail`.
2. Data backfill (same migration or an immediately-following one): `UPDATE "Worker" SET "paymentConfigured" = true WHERE "hourlyRateUpdatedAt" IS NOT NULL OR "paymentType" != 'MANUAL'`.
3. Ship the shared worker-creation function and switch CSV import to use it (behavior-preserving refactor — verify via existing import tests before adding new call sites).
4. Ship `td-sync.ts` changes: `paymentConfigured`-gated skip, `reason`-typed failure writes, hours-snapshot persistence.
5. Ship the resolve endpoint rewrite + admin UI (per-reason forms) and the manual add-worker action.
6. Ship the `GET /api/profile` fallback removal **last**, after confirming (via the sync's failure queue from step 4) that no currently-active self-registering worker would be wrongly locked out — i.e., let the `NEEDS_SETUP`/`MISSING_RATE` visibility work land and be observed for at least one sync cycle before tightening the profile endpoint.
- **Rollback**: each step is independently revertable; step 6 (profile fallback removal) is the one with user-facing blast radius (a real worker mid-registration could get "not recognized") and should be the first thing reverted if anything goes wrong post-deploy.

## Open Questions

- Should `admin-worker-detail.tsx`'s payment-section save be the *only* admin-side action that sets `paymentConfigured = true`, or should any admin edit to the worker record (e.g. just updating `team`) also count? Current design ties it specifically to the payment section to keep the signal precise — flagging in case implementation reveals other admin actions that should also count.
- R1's lock-sharing between the new shared worker-creation function and `claimPreprovisionedWorker` needs to be resolved as a concrete implementation task, not left implicit — see tasks.md.
