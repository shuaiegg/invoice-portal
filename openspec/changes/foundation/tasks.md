## 1. Dependencies & Environment

- [x] 1.1 Install dependencies: `npm install better-auth prisma @prisma/client`
- [x] 1.2 Create `.env.local` with `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- [x] 1.3 Verify Next.js 16 + BetterAuth compatibility — check BetterAuth docs for any Next.js 16-specific config requirements (Note: Next.js 16 uses `proxy.ts` instead of `middleware.ts`)

## 2. Database Schema

- [x] 2.1 Create `prisma/schema.prisma` and `prisma.config.ts` (Prisma 7 requires `prisma.config.ts` for datasources)
- [x] 2.2 Add generator block (`prisma-client-js`)
- [x] 2.3 Add `User` model (id, email, name, role, active, createdAt, relations to Worker/Session/Account)
- [x] 2.4 Add `Role` enum (`WORKER`, `ADMIN`)
- [x] 2.5 Add `Session` model (BetterAuth-compatible fields: id, userId, expiresAt, token, ipAddress, userAgent)
- [x] 2.6 Add `Account` model (BetterAuth-compatible fields: id, userId, provider, providerId, tokens, timestamps)
- [x] 2.7 Add `Worker` model (id, userId unique, all profile fields, relation to Invoice)
- [x] 2.8 Add `Invoice` model (all fields, `InvoiceStatus` enum, indexes on workerId/status/invoiceDate)
- [x] 2.9 Add `InvoiceStatus` enum (`SUBMITTED`, `APPROVED`, `PAID`, `VOID`)
- [x] 2.10 Add `InvoiceCounter` model (year as Int PK, count Int default 0)
- [x] 2.11 Add `WebhookConfig` model (key PK, url, enabled, environment, secret, internalSecret, lastTriggeredAt, updatedAt)
- [ ] 2.12 Run `npx prisma migrate dev --name init` and confirm success
- [x] 2.13 Run `npx prisma generate` and confirm TypeScript types are available (Note: Client generated to `lib/generated/client`)

## 3. Core Library Files

- [x] 3.1 Create `lib/db.ts` — Prisma client singleton (updated for Prisma 7 with pg adapter)
- [x] 3.2 Create `lib/auth.ts` — BetterAuth config: JWT session, `emailAndPassword` plugin enabled, `databaseHooks` for first-user-admin logic
- [x] 3.3 Create `lib/invoice-number.ts` — export `generateInvoiceNumber(year: number): Promise<string>` using atomic `INSERT ... ON CONFLICT DO UPDATE RETURNING count` raw SQL via Prisma

## 4. BetterAuth API Route

- [x] 4.1 Create `app/api/auth/[...betterauth]/route.ts` — export `GET` and `POST` handlers from BetterAuth's Next.js handler
- [ ] 4.2 Smoke test: `POST /api/auth/sign-up` creates a user in the DB

## 5. Proxy (Next.js 16)

- [x] 5.1 Create `proxy.ts` at project root — validate BetterAuth JWT session cookie (Note: Next.js 16 uses `proxy.ts` instead of `middleware.ts`)
- [x] 5.2 Configure `matcher` to exclude `/login`, `/register`, `/forgot-password`, `/api/auth/*`, and `/_next/*`
- [x] 5.3 On missing or expired session: redirect to `/login`
- [x] 5.4 On valid session: allow request to proceed (no role check in proxy)
- [x] 5.5 Verify proxy runs on Node.js Runtime (Next.js 16 default) and handles session validation

## 6. Route Group Structure & Layouts

- [x] 6.1 Create `app/(auth)/layout.tsx` — minimal layout (no nav, centered card)
- [x] 6.2 Create `app/(worker)/layout.tsx` — worker nav layout (nav bar with Dashboard, Profile, New Invoice links)
- [x] 6.3 Create `app/(admin)/layout.tsx` — admin nav layout; read session server-side, redirect to `/dashboard` if role is not ADMIN
- [x] 6.4 Delete `app/page.tsx` (old placeholder)
- [x] 6.5 Create `app/layout.tsx` — root layout (keep fonts, globals.css; remove placeholder content)

## 7. Auth Page Shells

- [x] 7.1 Create `app/(auth)/login/page.tsx` — login form shell (email + password fields, submit button, link to register)
- [x] 7.2 Create `app/(auth)/register/page.tsx` — registration form shell (name + email + password, link to login)
- [x] 7.3 Create `app/(auth)/forgot-password/page.tsx` — forgot password shell (email field)
- [x] 7.4 Wire login form to `POST /api/auth/sign-in` (BetterAuth client)
- [x] 7.5 Wire register form to `POST /api/auth/sign-up` (BetterAuth client); redirect ADMIN to `/admin`, WORKER to `/dashboard` based on returned role
- [x] 7.6 Add logout button/action to worker and admin layouts (calls `POST /api/auth/sign-out`)

## 8. Worker Page Shells

- [x] 8.1 Create `app/(worker)/dashboard/page.tsx` — placeholder "My Invoices" heading
- [x] 8.2 Create `app/(worker)/profile/page.tsx` — placeholder "My Profile" heading
- [x] 8.3 Create `app/(worker)/invoice/new/page.tsx` — placeholder "New Invoice" heading
- [x] 8.4 Create `app/(worker)/invoice/[id]/page.tsx` — placeholder, awaits `params` as Promise

## 9. Admin Page Shells

- [x] 9.1 Create `app/(admin)/admin/page.tsx` — placeholder "Admin Dashboard" heading
- [x] 9.2 Create `app/(admin)/admin/workers/page.tsx` — placeholder
- [x] 9.3 Create `app/(admin)/admin/workers/[id]/page.tsx` — placeholder, awaits params as Promise
- [x] 9.4 Create `app/(admin)/admin/invoices/page.tsx` — placeholder
- [x] 9.5 Create `app/(admin)/admin/invoices/[id]/page.tsx` — placeholder, awaits params as Promise
- [x] 9.6 Create `app/(admin)/admin/settings/page.tsx` — placeholder "Settings" heading

## 10. Internal Sync-Status Endpoint

- [x] 10.1 Create `app/api/internal/sync-status/route.ts` — POST handler
- [x] 10.2 Read `X-Internal-Secret` from request headers
- [x] 10.3 Fetch WebhookConfig for `invoice.submitted` key from DB; compare `internalSecret` — return 401 if mismatch
- [x] 10.4 Accept body `{ invoiceId: string, xeroInvoiceId: string }` and update Invoice record: `xeroSynced: true`, `xeroInvoiceId`, `xeroSyncedAt: new Date()`
- [x] 10.5 Return `{ success: true }` on success

## 11. WebhookConfig Admin Settings UI

- [x] 11.1 Create `app/api/admin/settings/webhooks/route.ts` — GET returns all WebhookConfig records with URLs masked (show only last 6 chars)
- [x] 11.2 Create `app/api/admin/settings/webhooks/[key]/route.ts` — PUT updates a WebhookConfig record (url, enabled, environment, secret, internalSecret)
- [x] 11.3 Update `app/(admin)/admin/settings/page.tsx` — fetch webhook configs, display table with masked URL, enabled toggle, environment, last triggered time
- [x] 11.4 Add inline edit form (or modal) for updating a webhook config URL and secrets
- [x] 11.5 Enabled/disabled toggle updates via PUT without a full form submit

## 12. Verification

- [ ] 12.1 Register first user → confirm redirected to `/admin` and DB shows `role: ADMIN` (Pending DB)
- [ ] 12.2 Register second user → confirm redirected to `/dashboard` and DB shows `role: WORKER` (Pending DB)
- [ ] 12.3 Log out → confirm session cleared and redirected to `/login` (Pending DB)
- [ ] 12.4 Visit `/dashboard` without session → confirm redirected to `/login` (Pending DB)
- [ ] 12.5 Log in as WORKER → visit `/admin` → confirm redirected to `/dashboard` (Pending DB)
- [ ] 12.6 Log in as ADMIN → visit `/admin` → confirm admin layout renders (Pending DB)
- [ ] 12.7 Test `/api/internal/sync-status` with wrong secret → confirm 401 (Pending DB)
- [ ] 12.8 Test `/api/internal/sync-status` with correct secret → confirm Invoice updated in DB (Pending DB)
- [x] 12.9 Run `npm run build` → confirm no TypeScript errors
