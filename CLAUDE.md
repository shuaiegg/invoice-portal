# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint

npx prisma migrate dev --name <name>   # Run DB migration (uses DIRECT_URL)
npx prisma generate                    # Regenerate Prisma client after schema change
```

## Project

**Worker Invoice Portal** — web app for 200+ remote contractors to submit monthly invoices. System auto-syncs to Xero (via n8n) and notifies #finance on Slack (via n8n). Admin dashboard for finance team to manage statuses and workers.

**Stack**: Next.js 16.2.9 · React 19.2.4 · Tailwind CSS v4 · TypeScript 5 · BetterAuth · Prisma · Neon PostgreSQL · shadcn/ui · Vercel · n8n (external integrations)

## Architecture Decisions

These are non-obvious decisions made during design — do not change without understanding the rationale.

**Auth — BetterAuth DB sessions + 5-minute cookie cache (no middleware.ts)**
There is no `middleware.ts` — every protected layout/page calls `auth.api.getSession()` itself, and every `/api/admin/*` route calls `requireAdmin()`. Sessions are DB-backed, but `session.cookieCache` in `lib/auth.ts` serves `getSession()` from a signed cookie for up to 5 minutes, so normal navigation costs zero auth DB round-trips. Note: BetterAuth has **no** top-level `session.strategy` option — a previous `strategy: "jwt"` config was silently ignored and every request hit the DB. Auth client for `'use client'` components lives in `lib/auth-client.ts`.

**Role checks: session for pages, DB for API mutations**
`User.role` is embedded on `session.user.role` via `user.additionalFields` in `lib/auth.ts` (`input: false`, never client-settable). Layouts and pages gate on `session.user.role` directly — no DB hit, but a promote/demote can lag by up to the cookie-cache maxAge (5 min). Admin API routes stay authoritative: `lib/admin-guard.ts` → `isAdminUser()` re-checks the DB on every call.

**First registered user automatically becomes ADMIN**
Implemented in BetterAuth's `before:create` user hook: if User count === 0, the row is inserted with `role: ADMIN`. It must be the *before* hook — the session cookie (and its cache) is built from the created row, so promoting after creation would leave the first admin browsing with a stale WORKER role. No seed script needed.

**Neon PostgreSQL requires two connection strings**
- `DATABASE_URL` — pooled (pgbouncer), used at runtime by Prisma
- `DIRECT_URL` — direct connection, used by `prisma migrate` only
Both must be set. Forgetting `DIRECT_URL` breaks migrations.

**Xero sync happens at the PAID transition, not at submission**
Invoice submission never touches Xero. When an admin marks an invoice PAID, `syncInvoiceToXero()` runs synchronously — on failure the invoice reverts to APPROVED and the admin sees the error. Bulk mark-paid uses `createXeroDraftBills()` (`lib/bulk-invoice-server.ts`): idempotent, batched 50 bills per POST, sized to stay inside Xero's 60-calls/min limit, with per-invoice failure reporting and a retry endpoint (`/api/admin/invoices/retry-xero`). OAuth tokens are managed in the `XeroToken` DB table (singleton row, refreshed when <2 min from expiry).

**PDF = HTML + `@media print` (no PDF library)**
Invoice detail page (`/invoice/[id]`) is the print template. "Download PDF" calls `window.print()`. `@media print` CSS hides UI chrome. No `@react-pdf/renderer` or puppeteer.

**Slack notifications via direct webhooks**
Slack notifications are fired directly from Next.js using an Incoming Webhook URL stored in `SLACK_WEBHOOK_URL`.

**Invoice numbers use atomic DB upsert**
`lib/invoice-number.ts` uses `INSERT INTO InvoiceCounter ... ON CONFLICT DO UPDATE RETURNING count` — race-condition safe. Format: `INV-{YYYY}-{NNNN}`.

**Timezone: Europe/Paris**
DB stores UTC always. All date display uses `Europe/Paris`. Invoice date default is set **client-side** (not server-side) using `Intl.DateTimeFormat`. PDF formats dates as DD/MM/YYYY.

**Invoice edit window: SUBMITTED status only**
Workers can revoke and re-edit an invoice while status is `SUBMITTED`. Once an admin sets it to `APPROVED`, the invoice is locked. Edit dispatches `invoice.updated` webhook (distinct from `invoice.submitted`).

**shadcn/ui requires canary for Tailwind v4**
Initialize with `npx shadcn@canary init`, not `npx shadcn@latest`. The canary version generates components using CSS variables compatible with Tailwind v4's `@theme` system.

## Route Structure

```
app/
  (auth)/          ← public: /login, /register, /forgot-password
  (worker)/        ← authenticated workers: /dashboard, /profile, /invoice/*
  (admin)/         ← ADMIN role only: /admin, /admin/workers, /admin/invoices, /admin/settings
  api/
    auth/
      [...betterauth]/       ← BetterAuth handler
      xero/connect/          ← Start Xero OAuth flow (Admin only)
      xero/callback/         ← Xero OAuth callback (Admin only)
    invoices/                ← worker invoice CRUD + Xero sync
    profile/                 ← worker profile
    admin/                   ← admin-only endpoints (requireAdmin() re-checks role in DB)
```

No `middleware.ts`: auth is enforced per layout/page (session) and per API route (DB). Route groups have `loading.tsx` skeletons so dynamic pages give instant navigation feedback.

## Key Library Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma client singleton (global pattern for hot-reload safety) |
| `lib/auth.ts` | BetterAuth server config (cookie-cached DB session, role on session, first-user-admin hook) |
| `lib/auth-client.ts` | BetterAuth client for `'use client'` components |
| `lib/xero.ts` | Xero API client (OAuth token mgmt, contact upsert, draft bill creation) |
| `lib/slack.ts` | Direct Slack Incoming Webhook notification helper |
| `lib/invoice-number.ts` | Atomic sequential invoice number generation |
| `lib/admin-guard.ts` | `requireAdmin(request)` helper for all `/api/admin/*` routes |

## Environment Variables

```env
DATABASE_URL=          # Neon pooled URL (pgbouncer=true) — runtime
DIRECT_URL=            # Neon direct URL — prisma migrate only
BETTER_AUTH_SECRET=    # Random secret for JWT signing
BETTER_AUTH_URL=       # = NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_URL=   # e.g. https://invoice.yourdomain.com
XERO_CLIENT_ID=        # Xero App Client ID
XERO_CLIENT_SECRET=    # Xero App Client Secret
XERO_REDIRECT_URI=     # {APP_URL}/api/auth/xero/callback
SLACK_WEBHOOK_URL=     # Slack Incoming Webhook URL
CRON_SECRET=           # Bearer secret used by Vercel Cron for /api/cron/td-sync
TD_API_TOKEN=          # Time Doctor JWT bootstrap/reference; runtime config is saved via Admin settings
TD_COMPANY_ID=         # Time Doctor company bootstrap/reference; runtime config is saved via Admin settings
```

## Next.js 16 — Critical Breaking Changes

Before writing any route, component, or data-fetching code, read the relevant guide in `node_modules/next/dist/docs/`:

- **`params` is a Promise**: Always `await params` before accessing properties in dynamic routes.
- **Server Components by default**: All layouts and pages are Server Components. Use `'use client'` only at the leaf level for interactivity.
- **`use cache` directive**: Replaces `fetch` cache options for caching async work in Server Components.
- **Tailwind CSS v4**: Configuration via CSS `@theme` block, not `tailwind.config.js`.

Key docs:
- `node_modules/next/dist/docs/01-app/01-getting-started/` — routing, data fetching, caching, Server vs Client components
- `node_modules/next/dist/docs/01-app/02-guides/` — use-case guides
- `node_modules/next/dist/docs/01-app/03-api-reference/` — file conventions, functions, config

## OpenSpec Changes

All planned changes are in `openspec/changes/`. Implementation order:

```
1. foundation      ← auth + Prisma schema + route structure
2. design-system   ← Tailwind tokens + shadcn/ui + shared components + auth UI
3. worker-portal   ← profile + invoice submission + history + print PDF
4. xero-direct     ← direct Xero sync + Slack notifications
5. admin-portal    ← admin dashboard + invoice management + worker management + CSV export
```

`n8n-integration` can run in parallel with `worker-portal` or `admin-portal` — it only touches n8n, not Next.js code.

Run `/opsx:apply <change-name>` to implement a change. Run `/opsx:explore` to think through problems before implementing.
