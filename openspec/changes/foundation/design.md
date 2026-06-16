## Context

The invoice portal is a freshly scaffolded Next.js 16.2.9 App Router project with no authentication, database, or application structure. This design covers the full foundation layer that all subsequent feature changes depend on.

Key constraints from the exploration phase:
- **Next.js 16**: `params` is a `Promise`, Server Components by default, Tailwind v4 CSS-first config
- **Edge Runtime middleware**: Prisma cannot run in Edge; session validation must be JWT-based (no DB lookups)
- **Neon PostgreSQL**: Serverless DB requires pooled connections at runtime and direct connection for migrations
- **n8n handles all external integrations**: No Xero or Slack credentials in Next.js; only webhook dispatch and a callback endpoint

## Goals / Non-Goals

**Goals:**
- Establish a working auth flow (register → login → protected route → logout)
- Define the complete Prisma schema for all domain models
- Create the full route group skeleton with shared layouts and middleware
- Implement the WebhookConfig model with admin management UI
- Produce a testable checkpoint: "unauthenticated user is redirected to /login"

**Non-Goals:**
- UI design or component implementation (covered in `design-system` change)
- Invoice submission logic (covered in `invoice-core` change)
- n8n workflow creation (covered in `xero-slack-n8n` change)
- Email verification or password reset implementation (scaffolded but not wired)

## Decisions

### D1: JWT session strategy over database sessions

**Decision**: BetterAuth configured with JWT sessions.

**Rationale**: Next.js middleware runs on the Edge Runtime where Prisma is unavailable. JWT sessions are validated by decoding and verifying the token signature — no DB round-trip needed. For a 200-person internal tool with no need for real-time session revocation, JWT with a 7-day expiry is appropriate.

**Alternative considered**: DB sessions with a middleware workaround (e.g., passing auth check to a Node.js API route). Rejected: adds latency, complicates the request path, and provides no meaningful security benefit for this use case.

### D2: First user becomes ADMIN via BetterAuth hook

**Decision**: Use BetterAuth's `after:sign-up` hook (or equivalent lifecycle callback) to count users and assign ADMIN role if count was 0.

**Rationale**: Avoids a seed script or manual DB operation. Works for both local dev and production deploys. The check is: `SELECT COUNT(*) FROM User` inside the hook before returning the created user — if count equals 1 (just created), assign ADMIN.

**Alternative considered**: `ADMIN_EMAIL` env var to promote specific users. Rejected: adds configuration burden; the first-user approach is zero-config.

### D3: Route groups with layout-level role enforcement

**Decision**: Three route groups — `(auth)`, `(worker)`, `(admin)` — with the admin layout checking `role === 'ADMIN'` and redirecting workers to `/dashboard`.

**Rationale**: Middleware handles authentication (is logged in?); layouts handle authorization (has the right role?). This separation keeps the Edge-compatible middleware simple and puts role logic in Node.js Server Components where Prisma is available.

**Structure**:
```
app/
  (auth)/layout.tsx          ← no nav, no session check
  (worker)/layout.tsx        ← worker nav bar, session from BetterAuth
  (admin)/layout.tsx         ← admin nav bar, checks role=ADMIN → redirect
  middleware.ts              ← JWT validation only, no role check
```

### D4: Atomic invoice number generation

**Decision**: Use a single `INSERT ... ON CONFLICT DO UPDATE RETURNING count` statement on the `InvoiceCounter` table.

**Rationale**: Atomic at the PostgreSQL level — no transactions, no `SELECT FOR UPDATE` locks, no application-level sequencing needed. Returns the new count in one round-trip.

```sql
INSERT INTO "InvoiceCounter" (year, count)
VALUES ($year, 1)
ON CONFLICT (year)
DO UPDATE SET count = "InvoiceCounter".count + 1
RETURNING count
```

Exposed via `lib/invoice-number.ts` as `generateInvoiceNumber(year: number): Promise<string>`.

### D5: Prisma client as a singleton

**Decision**: `lib/db.ts` exports a single PrismaClient instance using the global singleton pattern to prevent connection pool exhaustion during Next.js hot reloads in development.

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### D6: WebhookConfig keyed by event name + environment

**Decision**: WebhookConfig primary key is the event name string (e.g., `invoice.submitted`). Environment is a separate field (`production` | `development`) on each record.

**Rationale**: Allows independent configuration of test and production n8n workflows. The dispatch logic reads `NODE_ENV` at runtime and filters accordingly.

**URL masking**: The full URL is only ever read server-side. API responses replace the URL with `****` + last 6 chars. No client component ever receives the raw URL.

### D7: Internal sync-status endpoint security

**Decision**: `/api/internal/sync-status` validates `X-Internal-Secret` against the `internalSecret` field of the `invoice.submitted` WebhookConfig record. Returns 401 on mismatch.

**Rationale**: This endpoint modifies database records and must not be callable by arbitrary parties. The secret is managed through the admin settings UI alongside the webhook URL.

## Risks / Trade-offs

**JWT cannot be revoked server-side** → Mitigation: short expiry (7 days); admin can deactivate a user in DB which prevents new logins but does not invalidate existing sessions mid-term. Acceptable for an internal tool.

**First-user-admin logic has a race condition if two users register simultaneously on an empty DB** → Mitigation: both get ADMIN, which is safe (excess admins can be demoted). Not a practical concern for a controlled rollout.

**Neon cold start latency on free tier** → Mitigation: Vercel Cron job to ping DB every 5 days (added in a later change). First request after idle may be slow; acceptable for v1.

**BetterAuth Next.js 16 compatibility** → Mitigation: Check BetterAuth docs for any Next.js 16-specific configuration before implementation. Read `node_modules/next/dist/docs/` for relevant API changes.

## Migration Plan

1. Install dependencies: `npm install better-auth prisma @prisma/client`
2. Create `prisma/schema.prisma` with full schema
3. Configure Neon: get pooled URL + direct URL from Neon dashboard
4. Set env vars: `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
5. Run `npx prisma migrate dev --name init`
6. Run `npx prisma generate`
7. Implement auth, middleware, and route shells
8. Verify: register → admin redirect (first user) + register second user → worker dashboard

**Rollback**: Drop the Neon database branch; delete env vars from Vercel. No existing data to preserve at this stage.

## Open Questions

- BetterAuth version compatibility with Next.js 16.2.9 — verify before writing `lib/auth.ts`
- Neon free tier plan: confirm whether pgbouncer pooled URL is available (it is on all Neon plans including free)
