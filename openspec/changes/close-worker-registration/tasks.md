## 1. Schema & migration

- [ ] 1.1 Add `AppConfig` singleton model (`id: "singleton"`, `registrationOpen Boolean @default(true)`) following the `TimeDoctorConfig`/`XeroToken` pattern
- [ ] 1.2 Run `npx prisma migrate dev` and `npx prisma generate`; confirm default row behavior (no row yet = treat as `true`, or seed the singleton row — pick one and document it in the migration)

## 2. Sign-up gating

- [ ] 2.1 In `lib/auth.ts`'s `before:create` user hook, after the existing first-user-becomes-ADMIN check, add: if `AppConfig.registrationOpen` is `false` and this is not the first user, look up an unclaimed `Worker` matching the new user's email (case-insensitive) — reject the sign-up if none is found
- [ ] 2.2 Confirm the rejection surfaces as a generic error to the client (no distinction between "registration closed" and "email not matched")
- [ ] 2.3 Confirm `claimPreprovisionedWorker`'s existing `after:create` claim logic is unaffected (still runs normally for allowed sign-ups)

## 3. Admin Settings UI

- [ ] 3.1 Add a new admin API route (or extend an existing settings route) to read/write `AppConfig.registrationOpen`
- [ ] 3.2 Add a toggle control to `app/(admin)/admin/settings/page.tsx` (or a dedicated section) showing current state
- [ ] 3.3 Show the current count of unclaimed pending `Worker` rows (`userId IS NULL`) next to the toggle

## 4. Verification

- [ ] 4.1 `npm run lint` and `npm run build` pass
- [ ] 4.2 Manual check: with `registrationOpen: true` (default), confirm sign-up behavior is unchanged for both matched and unmatched emails
- [ ] 4.3 Manual check: flip `registrationOpen` to `false`, confirm a matched-email sign-up still succeeds and claims correctly
- [ ] 4.4 Manual check: with `registrationOpen: false`, confirm an unmatched-email sign-up is rejected with a generic error
- [ ] 4.5 Manual check: with `registrationOpen: false` and the `User` table emptied in a scratch/staging environment, confirm first-user bootstrap still succeeds and becomes ADMIN
