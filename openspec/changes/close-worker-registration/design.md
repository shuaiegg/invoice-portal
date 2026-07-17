## Context

`td-sync-worker-onboarding` closes the actual security gap (an unmatched `User` can no longer obtain a working `Worker` profile via `GET /api/profile`). This change is optional hardening on top: once the known migration window (the ~260 pre-existing CSV-imported workers claiming their accounts) is over, there's no remaining legitimate reason for `POST /api/auth/sign-up/email` to accept arbitrary emails, so Admin wants a way to turn it off — as a runtime setting, not a deploy.

## Goals / Non-Goals

**Goals:**
- Give Admin a single toggle, changeable without a deploy, that closes self-service account creation to only pending-matched emails.
- Preserve the first-user bootstrap path (empty `User` table) regardless of the toggle's value, so the app can never be locked out of having an admin.
- Give Admin visibility into how many pending workers are still unclaimed, so the decision to flip the toggle is informed rather than a guess.

**Non-Goals:**
- No live/cached Time Doctor roster check (rejected in the earlier design discussion — adds an external-API dependency to the auth-critical path; the pending-`Worker`-match check is sufficient and already exists).
- No retroactive action on `User` rows created before the toggle is flipped.
- No email-based invite flow — out of scope; Admin still notifies people manually about `/register` per `td-sync-worker-onboarding`'s Slack-invite decisions.

## Integration Boundary

Auth-only change; no external integration (Time Doctor, Xero, Wise, n8n) is touched or newly depended on.

## Decisions

### D1 — Gate at the BetterAuth `before:create` hook, not the `/register` page or a separate middleware
`lib/auth.ts` already has a `before:create` hook (first-user-becomes-ADMIN). Adding the registration-open check there means it's enforced no matter which client calls `sign-up/email` (the React form, a script, a future mobile client) — a page-level check on `/register` alone would be bypassable by calling the API directly, which is exactly the gap `GET /api/profile`'s fix in the other proposal is closing for a different endpoint. Consistent enforcement point.

### D2 — New `AppConfig` singleton table, following the existing `TimeDoctorConfig`/`XeroToken` `id: "singleton"` pattern
No existing table is a natural fit for a general app-wide runtime flag. A one-row singleton table matches the pattern already established twice in this schema, rather than introducing a new pattern (e.g. an environment variable, which would require a deploy to change — defeating the purpose).

### D3 — Reject with a generic error message
The rejection response should not reveal *why* (e.g. "this email isn't recognized" vs. a generic "registration is currently closed") to avoid trivially confirming which emails are/aren't real contractors to an outside prober. A single generic message covers both the "registration closed" and "email not matched" cases.

## Risks / Trade-offs

- **[Risk] Admin flips the toggle before all pending workers have claimed** → some legitimate workers get locked out. Mitigation: show the unclaimed-pending-worker count directly next to the toggle so this is a visible, informed decision, not a guess; the toggle is instantly reversible (no deploy).
- **[Risk] Toggle state itself becomes stale/forgotten** (e.g. flipped off once, then a new legitimate need for open registration arises months later and nobody remembers the switch exists) → low severity, purely a UX/discoverability concern; the Admin Settings page is the natural, already-visited home for it.

## Migration Plan

1. Add `AppConfig` table + migration (default `registrationOpen: true` — no behavior change on deploy).
2. Add the `before:create` hook check (inert while `registrationOpen: true`, i.e. safe to ship ahead of actually wanting to close it).
3. Add the Settings UI toggle + pending-worker count.
4. Operationally: once the pending cohort is confirmed claimed (via the count shown in step 3), Admin flips the toggle — no further deploy needed.

**Rollback**: flip the toggle back to `true` — no code rollback needed for the common case; a genuine code rollback (reverting the hook check) is a normal revert if the hook logic itself has a bug.

## Open Questions

- Should the "unclaimed pending worker count" shown next to the toggle also break down by how long each has been pending (e.g. flag ones pending >90 days for Admin follow-up), or is a raw count sufficient for this change? Defaulting to a raw count; can be revisited if Admin finds it insufficient in practice.
