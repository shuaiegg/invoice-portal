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

**Auth — BetterAuth with JWT sessions (not DB sessions)**
Next.js middleware runs on Edge Runtime where Prisma is unavailable. JWT sessions are validated by token decoding — no DB round-trip. Configured in `lib/auth.ts`. Auth client for `'use client'` components lives in `lib/auth-client.ts`.

**First registered user automatically becomes ADMIN**
Implemented in BetterAuth's `after:sign-up` hook: if User count === 1 after creation, set `role: ADMIN`. No seed script needed.

**Neon PostgreSQL requires two connection strings**
- `DATABASE_URL` — pooled (pgbouncer), used at runtime by Prisma
- `DIRECT_URL` — direct connection, used by `prisma migrate` only
Both must be set. Forgetting `DIRECT_URL` breaks migrations.

**No Xero or Slack credentials in Next.js**
All external integrations (Xero contact upsert, Xero draft bill, Slack notification) are handled entirely by n8n workflows. Next.js only fires fire-and-forget webhook POSTs to n8n. Do not add Xero/Slack API clients to this codebase.

**PDF = HTML + `@media print` (no PDF library)**
Invoice detail page (`/invoice/[id]`) is the print template. "Download PDF" calls `window.print()`. `@media print` CSS hides UI chrome. No `@react-pdf/renderer` or puppeteer.

**Webhook dispatch is fire-and-forget**
`lib/webhook.ts` exports `dispatchWebhook(key, payload)` — reads `WebhookConfig` from DB, fires fetch without awaiting, swallows errors. n8n handles retries. User response is never blocked by webhook status.

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
    auth/[...betterauth]/    ← BetterAuth handler
    internal/sync-status/    ← n8n callback to update xeroSynced (secured with X-Internal-Secret)
    invoices/                ← worker invoice CRUD
    profile/                 ← worker profile
    admin/                   ← admin-only endpoints (enforce role server-side)
middleware.ts      ← JWT validation only, no role check, Edge Runtime
```

## Key Library Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma client singleton (global pattern for hot-reload safety) |
| `lib/auth.ts` | BetterAuth server config (JWT session, first-user-admin hook) |
| `lib/auth-client.ts` | BetterAuth client for `'use client'` components |
| `lib/invoice-number.ts` | Atomic sequential invoice number generation |
| `lib/webhook.ts` | Fire-and-forget webhook dispatch with WebhookConfig lookup |
| `lib/admin-guard.ts` | `requireAdmin(request)` helper for all `/api/admin/*` routes |

## Environment Variables

```env
DATABASE_URL=          # Neon pooled URL (pgbouncer=true) — runtime
DIRECT_URL=            # Neon direct URL — prisma migrate only
BETTER_AUTH_SECRET=    # Random secret for JWT signing
BETTER_AUTH_URL=       # = NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_URL=   # e.g. https://invoice.yourdomain.com
```

No Xero or Slack variables — those live in n8n credentials.

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
1. foundation      ← auth + Prisma schema + route structure + WebhookConfig
2. design-system   ← Tailwind tokens + shadcn/ui + shared components + auth UI
3. worker-portal   ← profile + invoice submission + history + print PDF
4. n8n-integration ← build n8n workflows (Xero + Slack) via n8n MCP tools
5. admin-portal    ← admin dashboard + invoice management + worker management + CSV export
```

`n8n-integration` can run in parallel with `worker-portal` or `admin-portal` — it only touches n8n, not Next.js code.

Run `/opsx:apply <change-name>` to implement a change. Run `/opsx:explore` to think through problems before implementing.
