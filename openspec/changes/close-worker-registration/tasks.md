## 1. Schema & migration

- [x] 1.1 Added `AppConfig` singleton model (`id: "singleton"`, `registrationOpen Boolean @default(true)`, `updatedAt`) following the `TimeDoctorConfig`/`XeroToken` pattern. Also added `Worker.claimToken`/`claimTokenExpiresAt` in the same migration (group 4 needs them; no reason to split into two migrations for one session).
- [x] 1.2 Applied via `prisma migrate diff` + `db execute` + manual `_prisma_migrations` insert (same non-interactive-environment workaround as the previous change) + `prisma generate`. Decision: **no row yet = treat as `true`** — no seed step, application code (`lib/app-config.ts`) handles the missing-row case explicitly.

## 2. Sign-up gating

- [x] 2.1 Added the gate to `lib/auth.ts`'s `before:create` hook, after the first-user check: if `!isRegistrationOpen()` and no unclaimed `Worker` matches the email case-insensitively, `throw new APIError("FORBIDDEN", {...})`.
- [x] 2.2 Single generic message ("Registration is not available for this account.") for both the closed-registration case and the unmatched-email case — no branching that would let a client distinguish them.
- [x] 2.3 `claimPreprovisionedWorker`'s `after:create` hook is untouched; the new check lives entirely in `before:create` and only ever prevents the `User` row from being created in the first place — when it doesn't throw, everything downstream (including the claim) runs exactly as before.

## 3. Admin Settings UI

- [x] 3.1 `lib/app-config.ts` (`isRegistrationOpen`/`setRegistrationOpen`, no-row-means-open semantics) + `app/api/admin/settings/registration/route.ts` (GET current state + pending count, PUT to flip it).
- [x] 3.2 `components/admin/registration-toggle.tsx` — a `Switch` wired to the API, wired into `app/(admin)/admin/settings/page.tsx`'s existing integrations grid.
- [x] 3.3 Pending-worker count shown next to the toggle, with a warning line when registration is still open and the count is nonzero ("wait for this to reach 0 before closing").

## 4. Worker claim link (Add worker dialog only)

- [x] 4.1 Added `Worker.claimToken String? @unique` and `Worker.claimTokenExpiresAt DateTime?`, applied in the same migration as group 1 (`20260717080000_registration_close_and_claim_link`).
- [x] 4.2 `lib/worker-claim-token.ts` — `generateClaimToken()`, 32 random bytes base64url, 21-day expiry. Not in `lib/worker-provisioning.ts`, per design.
- [x] 4.3 `app/api/admin/workers/manual-add/route.ts` now issues a token inside the same transaction right after `provisionWorker` and returns `claimToken` in the response.
- [x] 4.4 `components/admin/add-worker-dialog.tsx` shows a success state with the `/claim/{token}` URL, a copy button (`Copy`/`Check` icon swap), and a "Done" button — replaces the old toast-only flow.
- [x] 4.5 `app/(auth)/claim/[token]/page.tsx` (server component, inherits the shared `(auth)` layout) looks up the worker, checks `userId IS NULL` + expiry, and either renders an "invite link invalid" card or `components/auth/claim-form.tsx` (name + password + confirm, client component).
- [x] 4.6 `app/api/claim/[token]/route.ts`: validates token/expiry/`userId IS NULL`, then calls `auth.api.signUpEmail({ body: {...}, returnHeaders: true })` — this is the *same* public sign-up path, so the existing `before:create` gate (group 2) and `after:create` claim hook both run unmodified; the gate passes for free since a valid token implies a matching pending `Worker`. Forwards the `Set-Cookie` header onto the route's response so the worker is immediately signed in. Clears `claimToken`/`claimTokenExpiresAt` on success (`userId IS NOT NULL` guard — hygiene, not the primary defense, since `claimPreprovisionedWorker`'s own `userId IS NULL` check inside the hook is what actually prevents a double-claim).
- [x] 4.7 Added `POST /api/admin/workers/[id]/claim-link` + a "Claim link" panel in `components/admin/admin-worker-detail.tsx` (shown only when `!worker.userId`) with "Generate"/"Regenerate" + copy — available for *any* pending worker, not just ones created via "Add worker" (matches the spec's wording; CSV-imported pending workers keep self-register as the default path, but admin can still hand one a direct link on request).

## 5. Verification

- [x] 5.1 `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm test` (66/66) all pass. Confirmed via a read-only query that `AppConfig` has no row yet in the real DB, so `isRegistrationOpen()` correctly falls back to `true` (no behavior change from this deploy).
- [ ] 5.2 Manual check: with `registrationOpen: true` (default), confirm sign-up behavior is unchanged for both matched and unmatched emails
- [ ] 5.3 Manual check: flip `registrationOpen` to `false`, confirm a matched-email sign-up still succeeds and claims correctly
- [ ] 5.4 Manual check: with `registrationOpen: false`, confirm an unmatched-email sign-up is rejected with a generic error
- [ ] 5.5 Manual check: with `registrationOpen: false` and the `User` table emptied in a scratch/staging environment, confirm first-user bootstrap still succeeds and becomes ADMIN
- [ ] 5.6 Manual check: create a worker via "Add worker", confirm the claim link is shown; open it in an incognito window, set a password, confirm the account is created and linked to the right `Worker`
- [ ] 5.7 Manual check: confirm an expired or already-used claim link shows the error state and creates no account
- [ ] 5.8 Manual check: with `registrationOpen: false`, confirm a valid claim link still succeeds (not blocked by the general gate)
- [ ] 5.9 Manual check: regenerate a claim link and confirm the old token no longer works

**5.2–5.9 deliberately left undone by this session** — same reasoning as `td-sync-worker-onboarding`'s group 7: these create real `User`/`Worker` rows (and 5.5 requires emptying the `User` table) against the production-connected DB in `.env.local`. Recommend running these by hand, ideally against a staging DB, before merging — 5.6 in particular is worth doing for real since it's the one totally new user-facing flow in this change.
