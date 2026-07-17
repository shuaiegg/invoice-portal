## Why

The public `/register` form is intentionally open today so the ~260 CSV-imported-but-not-yet-claimed workers can self-register and be matched by their Time Doctor email (`claimPreprovisionedWorker`). Once `td-sync-worker-onboarding` ships, an unmatched email can no longer obtain a working `Worker` profile — but the `User` account itself can still be created by anyone. Once the pending cohort finishes claiming, leaving account creation open indefinitely serves no purpose and is unnecessary attack surface (junk accounts, credential-stuffing targets, enumeration) for zero remaining benefit. Admin wants the ability to close it once that migration window is over, without a code deploy each time.

## What Changes

- A new admin-controlled setting, `registrationOpen` (default `true`), gates whether `POST /api/auth/sign-up/email` succeeds for an email with no matching pending `Worker`.
- When `registrationOpen` is `false`: sign-up succeeds only if (a) the email matches an unclaimed pending `Worker.timeDoctorEmail` (same match `claimPreprovisionedWorker` already performs), or (b) no `User` exists yet (first-run admin bootstrap, preserving the existing `before:create` first-user-becomes-ADMIN behavior). Otherwise sign-up is rejected with a clear, non-enumerating error.
- When `registrationOpen` is `true` (default, unchanged from today): behavior is exactly as it is now — anyone can create a `User`, but (per `td-sync-worker-onboarding`) only a matched email ever gets a working `Worker` profile.
- Admin Settings gets a toggle to flip `registrationOpen`, with the current count of still-unclaimed pending workers shown alongside it so Admin can judge when it's safe to close.

## Capabilities

### New Capabilities
- `registration-access-control`: admin-configurable gating of new account creation, independent of (and layered on top of) worker-profile claiming.

### Modified Capabilities
(none — this is additive; it doesn't change how claiming or profile creation already work)

## Impact

- **Touches**: new `AppConfig` singleton table (or equivalent), `lib/auth.ts` (`before:create` hook), `app/(admin)/admin/settings/page.tsx` (or a new settings sub-page), a new admin API route for the toggle.
- **Does not touch**: `GET /api/profile`, `claimPreprovisionedWorker`, Worker creation/matching logic, Xero, Wise, n8n, invoice flows — all already correctly scoped by `td-sync-worker-onboarding`.
- **Depends on**: `td-sync-worker-onboarding` shipping first (specifically its `GET /api/profile` fix) — without it, closing registration adds no real security value since an unmatched `User` could still gain a working profile today.
- **Non-goals**: no email-sending, no TD roster live/cached check, no retroactive effect on already-created `User` rows.
