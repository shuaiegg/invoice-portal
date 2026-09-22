# Worker Invoice Portal

A web application for 200+ remote contractors to submit monthly invoices, with an admin dashboard for the finance team to manage statuses, sync to Xero, and fire event notifications through n8n (Slack included).

**Stack**: Next.js · React 19 · Tailwind CSS v4 · TypeScript · BetterAuth · Prisma · Neon PostgreSQL · shadcn/ui · Vercel

---

## Prerequisites

- [Vercel](https://vercel.com) account
- [Neon](https://neon.tech) PostgreSQL project
- [Xero](https://developer.xero.com) app (for accounting sync)
- An n8n instance with webhook triggers (for Slack/finance notifications — configured post-deploy via Admin Settings, not an env var)
- Time Doctor API credentials (for automated hour sync)

---

## Environment Variables

Set all of the following in Vercel → Project → Settings → Environment Variables (or in `.env.local` for local development).

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon **pooled** connection string (includes `?pgbouncer=true&sslmode=require`) |
| `DIRECT_URL` | Neon **direct** connection string — used by `prisma migrate` only |
| `BETTER_AUTH_SECRET` | Random secret for session signing — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Full app URL, e.g. `https://invoice.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Same as `BETTER_AUTH_URL` |
| `XERO_CLIENT_ID` | Xero app Client ID |
| `XERO_CLIENT_SECRET` | Xero app Client Secret |
| `XERO_REDIRECT_URI` | Optional — auto-derived as `{NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`; only set to override |
| `CRON_SECRET` | Random secret used by Vercel Cron to authenticate cron endpoints |
| `TD_API_TOKEN` | Time Doctor API JWT (bootstrap reference — can be updated via Admin → Settings) |
| `TD_COMPANY_ID` | Time Doctor company ID (bootstrap reference — can be updated via Admin → Settings) |

> **Important**: `DATABASE_URL` and `DIRECT_URL` must both be set. Using only one will cause either runtime failures or broken migrations.

---

## Database Setup

This project uses [Neon](https://neon.tech) PostgreSQL. Neon provides two connection strings per database — **pooled** (via pgbouncer) and **direct**.

1. Create a Neon project and copy both connection strings from the Neon Console.
2. Set `DATABASE_URL` to the **pooled** URL and `DIRECT_URL` to the **direct** URL.
3. Run migrations against the direct connection:

```bash
npx prisma migrate deploy
```

> During local development, use `npx prisma migrate dev --name <name>` to create new migrations.

---

## Deploying to Vercel

### 1. Connect the repository

In the Vercel dashboard, import the GitHub repository. Vercel auto-detects Next.js — no build configuration needed.

### 2. Set environment variables

Add all variables from the table above in Vercel → Settings → Environment Variables. Apply to **Production**, **Preview**, and **Development** as appropriate.

### 3. Deploy

Trigger a deployment (push to `main` or click "Deploy" in Vercel). Vercel runs `npm run build` automatically.

### 4. Run database migrations

After the first deployment, run migrations against your Neon database:

```bash
DIRECT_URL=<your-direct-url> npx prisma migrate deploy
```

Or run this from your local machine with the production `DIRECT_URL` set in `.env.local`.

---

## Post-Deployment Setup

### First Admin Account

The first user to register on the portal automatically becomes an Admin — no seed script required. Open `{APP_URL}/register`, create your account, and you will have full admin access immediately.

All subsequent registrations create Worker accounts by default. Admins can promote users to Admin in **Admin → Settings → Users**.

> Worker registration can be closed from **Admin → Settings** once onboarding is complete.

### Xero Integration

1. In the Xero developer portal, create an app with:
   - OAuth 2.0 redirect URI: `{APP_URL}/api/auth/xero/callback`
   - Scopes: `accounting.transactions`, `accounting.contacts`
2. Set `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, and `XERO_REDIRECT_URI` in Vercel.
3. In the admin portal, go to **Settings → Xero** and click **Connect Xero** to complete the OAuth flow.

Once connected, invoices are synced to Xero automatically when marked as **Paid**.

### n8n Notifications (Slack, etc.)

All outbound events dispatch to n8n, not directly to Slack — n8n decides where each event goes (Slack channel, another system, etc.).

1. In n8n, create a Webhook Trigger for each event you want to handle.
2. In the admin portal, go to **Settings → n8n Webhook Configuration** and, for each event key, set the n8n webhook URL and toggle it enabled. Each row shows a "Last Triggered" timestamp so you can confirm delivery.
3. Run the seed script (`lib/seed-webhooks.ts`) after first deploy to pre-populate the event key rows, or add them individually via the UI.

Event keys fired: `invoice.submitted`, `invoice.updated`, `invoice.revoked`, `invoice.status_changed`, `invoice.paid`, `invoice.changes_requested`, `invoice.bulk_completed`, `worker.invited`, `td.sync_completed`, `td.sync_failed`, `td.draft_ready`.

### Time Doctor Sync

1. Obtain your Time Doctor API token and company ID.
2. Set `TD_API_TOKEN` and `TD_COMPANY_ID` as bootstrap values in Vercel.
3. In the admin portal, go to **Settings → Time Doctor** to verify the connection and update credentials if needed.

The TD sync runs automatically via cron on the 1st of each month at 06:00 UTC, generating draft invoices for all matched workers.

---

## Cron Jobs

Configured in `vercel.json` — Vercel runs these automatically on the Pro plan.

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `0 6 1 * *` (1st of month, 06:00 UTC) | `/api/cron/td-sync` | Sync Time Doctor hours → generate invoices |
| `0 8 2 * *` (2nd of month, 08:00 UTC) | `/api/cron/report` | Generate monthly finance report |

Both endpoints require the `Authorization: Bearer {CRON_SECRET}` header. Vercel adds this automatically; set `CRON_SECRET` in environment variables.

---

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful commands

```bash
npm run dev      # Start dev server (hot reload)
npm run build    # Production build
npm run lint     # Run ESLint

npx prisma migrate dev --name <name>   # Create and apply a new migration
npx prisma generate                    # Regenerate Prisma client after schema changes
npx prisma studio                      # Open Prisma Studio (DB browser)
```
