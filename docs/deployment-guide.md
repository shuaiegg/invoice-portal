# Deployment Guide

This guide walks through deploying the Worker Invoice Portal from a GitHub fork to Vercel, including all required external services.

---

## Overview

| Service | Purpose | Required |
|---------|---------|----------|
| GitHub | Source code hosting | Yes |
| Vercel | Hosting & CI/CD | Yes |
| Neon PostgreSQL | Database | Yes |
| Xero | Accounting sync | Optional |
| n8n | Event notifications (Slack, etc.) | Optional |
| Time Doctor | Automation | Optional |

---

## Step 1 — Fork the Repository

1. Open the source repository on GitHub
2. Click **Fork** → **Create fork**
3. Keep the default settings and confirm

> **Staying in sync with upstream updates:**
> When the original repo receives updates, go to your fork on GitHub and click **"Sync fork"** → **"Update branch"**. Vercel will detect the new commit and automatically redeploy. No manual steps needed.

---

## Step 2 — Set Up Neon PostgreSQL

Neon is a serverless Postgres provider with a free tier. The project requires **two connection strings** (pooled + direct).

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new **Project** (choose a region close to your users)
3. In the project dashboard, open **Connection Details**
4. Copy the **Connection string** — this is your `DATABASE_URL`
   - Make sure the URL includes `?sslmode=require`
   - The pooled URL contains `-pooler` in the hostname (e.g. `ep-xxx-pooler.region.aws.neon.tech`)
5. For `DIRECT_URL`, use the same credentials but with the **direct** hostname (without `-pooler`)

Your two URLs will look like:

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

---

## Step 3 — Generate Required Secrets

### BetterAuth Secret

Generate a random 64-character hex string for `BETTER_AUTH_SECRET`:

```bash
openssl rand -hex 32
```

Or use any password generator — just make it long and random.

---

## Step 4 — Configure Xero (Optional)

Skip this section if you don't need accounting sync. Invoice submission and management will work without Xero; the "Mark Paid" action will complete without syncing.

> **Order of operations:** You need your final domain before creating the Xero app, because the Redirect URI must be exact. If you're using a custom domain, set that up first (Step 6 + custom domain). If you're using the default Vercel URL (`your-app.vercel.app`), you can create the Xero app after Step 6a when Vercel shows you the assigned URL.

### Create the Xero App

1. Sign in to [developer.xero.com](https://developer.xero.com)
2. Click **New app**
3. Fill in:
   - **App name**: Worker Invoice Portal (or any name)
   - **Company or application URL**: `https://your-domain.com`
   - **OAuth 2.0 redirect URI**: `https://your-domain.com/api/auth/xero/callback`
4. After creating the app, copy:
   - **Client ID** → `XERO_CLIENT_ID`
   - **Client Secret** → `XERO_CLIENT_SECRET`

> `XERO_REDIRECT_URI` is **not required as an env var** — the app derives it automatically as `{NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`. You only need to register that exact URL in the Xero app above; only set the env var explicitly if the app's public URL differs from what's registered with Xero (e.g. behind a proxy).

The app requests these OAuth scopes (hardcoded in the connect route):
`openid`, `profile`, `email`, `offline_access`, `accounting.contacts`, `accounting.invoices`, `accounting.settings`

Your Xero user account must have permission to manage **Contacts** and **Bills** in the connected organisation.

### How the connection works

Xero uses OAuth 2.0. The three environment variables (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`) are static credentials that identify your app. The actual OAuth tokens (access token + refresh token + tenant ID) are obtained once via the Admin UI and stored in the `XeroToken` database table. They are **refreshed automatically** by the server — you never need to update environment variables after the initial connection.

To complete the connection after deployment: Admin Settings → Xero → **Connect Xero Account**. If you later switch Xero organisations, use **Reconnect Xero** — this clears cached contact IDs so they are recreated in the new organisation on the next sync.

---

## Step 5 — Configure Notifications via n8n (Optional)

Notifications (Slack included) are **not** sent directly from this app — every event dispatches through `dispatchWebhook()` (`lib/webhook.ts`) to a per-event n8n Webhook Trigger URL stored in the `WebhookConfig` DB table, and n8n decides where it goes from there (Slack, another system, etc.). This is done via Admin UI after deployment, not an env var — see Step 10. There is no direct-to-Slack code path or `SLACK_WEBHOOK_URL` env var — that was migrated off and removed after all 8 non-TD event keys were verified end-to-end.

---

## Step 6 — Deploy to Vercel

### 6a — Import the Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New… → Project**
3. Select **Import Git Repository** → choose your **forked** repo
4. Vercel will auto-detect Next.js — no framework settings need changing

### 6b — Set Environment Variables

Before clicking **Deploy**, scroll down to **Environment Variables** and add all of the following:

**Database & Auth (Required)**

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Neon pooled URL | From Step 2 |
| `DIRECT_URL` | Neon direct URL | From Step 2 |
| `BETTER_AUTH_SECRET` | Random hex string | From Step 3 |
| `BETTER_AUTH_URL` | `https://your-app.vercel.app` | Your Vercel URL |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Same as above |

**Company Info — shown on every invoice PDF (Required)**

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_COMPANY_NAME` | Your company name | e.g. `Acme Corp Ltd` |
| `NEXT_PUBLIC_COMPANY_VAT` | Your VAT / tax number | e.g. `IE1234567AB` |
| `NEXT_PUBLIC_COMPANY_ADDRESS` | Street address | e.g. `123 Main Street` |
| `NEXT_PUBLIC_COMPANY_CITY` | City + postcode | e.g. `Dublin 15` |
| `NEXT_PUBLIC_COMPANY_COUNTRY` | Country | e.g. `Ireland` |

> These have hardcoded fallbacks but they contain the original owner's company details — **always override them** with your own.

**Cron Jobs (Required if using automation)**

| Variable | Value | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Any random string | Secures `/api/cron/*` endpoints |

**Integrations (Optional)**

| Variable | Value | Notes |
|----------|-------|-------|
| `XERO_CLIENT_ID` | From Xero app | See Step 4 |
| `XERO_CLIENT_SECRET` | From Xero app | See Step 4 |
| `XERO_REDIRECT_URI` | *(usually leave unset)* | Auto-derived from `NEXT_PUBLIC_APP_URL`; only set to override — see Step 4 |

> **Notifications have no env var at all** — they're configured after deployment via Admin Settings → n8n Webhook Configuration (see Step 10), not `.env`.

> **Time Doctor credentials** are NOT set here — they are configured through the Admin Settings UI after deployment and stored in the database.

> **Important:** Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your actual domain. If you set up a custom domain later, update both variables and redeploy.

### 6c — Deploy

Click **Deploy**. Vercel will:
1. Install dependencies
2. Run `prisma generate` (part of the build script)
3. Build the Next.js app

The first build takes ~2 minutes. Subsequent deploys are faster.

---

## Step 7 — Run Database Migrations

The Vercel build does **not** run migrations automatically — only `prisma generate`. You must run migrations manually from your local machine after the first deploy.

### One-time local setup

```bash
git clone https://github.com/YOUR_USERNAME/invoice-portal.git
cd invoice-portal
npm install
```

Create a `.env.local` file with just the two database URLs:

```env
DATABASE_URL=<your Neon pooled URL>
DIRECT_URL=<your Neon direct URL>
```

### Run migrations

```bash
npx prisma migrate deploy
```

This applies all migrations in `prisma/migrations/` to your Neon database. Run this command:
- After the first deployment
- After any future deployment that includes a new migration file

> **Tip:** You can also run `npx prisma studio` to visually inspect your database after migration.

---

## Step 8 — Create the First Admin Account

1. Open your deployed app (e.g. `https://your-app.vercel.app`)
2. Click **Register** and create your account
3. **The first registered user is automatically given the ADMIN role** — no manual steps needed

> If you already have other users in the database, the first-admin promotion won't apply. In that case, you can manually update the role via Prisma Studio or `psql`.

---

## Step 9 — Connect Xero (If Configured)

1. Log in as admin and navigate to **Settings** (`/admin/settings`)
2. Click **Configure Xero**
3. On the Xero settings page, click **Connect Xero Account**
4. Authorize the app in the Xero OAuth popup
5. You are redirected back — the status badge should show **Connected** with a Tenant ID

---

## Step 10 — Configure n8n Webhooks (If Using n8n)

If you have an n8n instance and want it to receive events (invoice lifecycle, worker onboarding, TD sync), configure the webhook URLs after deployment. This is the **only** notification path this app uses — there is no direct Slack integration; n8n routes to Slack (or anywhere else) itself.

**One-time setup:**

1. Run `lib/seed-webhooks.ts` once against your database to pre-populate a `WebhookConfig` row per event key (seeded **disabled** with a placeholder URL, except `invoice.submitted`/`invoice.updated` if `N8N_INVOICE_SUBMITTED_URL`/`N8N_INVOICE_UPDATED_URL` were set at seed time).
2. In n8n, create a Webhook Trigger for each event you want to handle.

**Via Admin UI (for each event):**

1. In Admin → **Settings**, scroll to the **n8n Webhook Configuration** section
2. Click **Configure** on the event, paste your n8n webhook URL
3. Optionally set a **Secret** — it will be sent as the `X-Webhook-Secret` header so n8n can verify the request
4. Toggle **Enabled** on
5. After the event next fires, the row's **Last Triggered** column updates — use this to confirm delivery without digging through n8n's execution logs

**Events fired and their payloads:**

| Event | Trigger | Payload fields |
|-------|---------|---------------|
| `invoice.submitted` | Worker submits invoice | `invoiceId`, `invoiceNumber`, `worker.id`, `worker.name`, `invoice.period`, `invoice.totalAmount`, `invoice.currency` |
| `invoice.updated` | Worker edits a submitted invoice | Same as above |
| `invoice.revoked` | Worker revokes a submitted invoice | Same as above |
| `invoice.status_changed` | Admin changes invoice status | Same as above, plus `from`, `to` |
| `invoice.paid` | Invoice transitions to PAID (single or bulk) | Same as above, plus `worker.paymentType` (and `worker.email` on the single-invoice path) |
| `invoice.changes_requested` | Admin sends an invoice back to Draft | Same as above, plus `note` |
| `invoice.bulk_completed` | Bulk approve/mark-paid action finishes | `action`, `count`, totals/breakdown fields, `xeroFailed` |
| `worker.invited` | New worker created via TD CSV import | `worker.name`, `worker.timeDoctorEmail`, `registrationUrl` |
| `td.sync_completed` | Monthly TD sync run finishes | sync result counts + `totalsByCurrency` |
| `td.sync_failed` | Monthly TD sync run fails to start | *(empty payload)* |
| `td.draft_ready` | TD_PLUS worker's draft invoice is generated | `invoiceId`, `invoiceNumber`, `worker.id`, `worker.name`, `invoice.period`, `invoice.totalAmount`, `invoice.currency` |

All payloads also include `eventKey`, `timestamp`, and `environment`.

> n8n webhooks are **fire-and-forget** — failures are logged but do not affect the API response or user experience.

---

## Step 11 — Configure Time Doctor (If Using Automation)

Time Doctor is used for automatic monthly invoice generation. It is configured via the Admin UI — no environment variables needed.

1. In Admin → **Settings**, click **Configure Time Doctor**
2. Enter your **Time Doctor email** and **password** (the account must have access to the company's workspace)
3. Click **Connect** — this calls the Time Doctor API to obtain a token, which is saved to the database
4. The token expiry is shown. Tokens last approximately 1 year; reconnect when the expiry warning appears

> **What it does:** On the 1st of each month (via cron), the system fetches worker hours from Time Doctor, creates draft invoices for TD-matched workers, and posts a summary to Slack.

---

## Step 12 — Post-Deployment Checklist

After completing the setup steps above, verify the following:

- [ ] App loads at your domain without errors
- [ ] Worker registration works (create a test worker account)
- [ ] First admin account has the ADMIN role (check via Admin dashboard)
- [ ] Invoice submission triggers `invoice.submitted` (check "Last Triggered" in Admin → Settings → n8n Webhook Configuration, if n8n is configured)
- [ ] Xero status shows Connected (if Xero is configured)
- [ ] Consider **closing public registration** once all workers are onboarded: Admin → Settings → Registration toggle → Off

---

## Step 13 — Configure Cron Jobs

The project includes two scheduled tasks defined in `vercel.json`:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/td-sync` | 1st of month, 06:00 UTC | Time Doctor sync |
| `/api/cron/report` | 2nd of month, 08:00 UTC | Monthly report |

These run automatically on Vercel Hobby and Pro plans. Vercel calls the endpoints with a `Bearer <CRON_SECRET>` header, which the endpoints verify. No additional setup is needed beyond setting `CRON_SECRET` in environment variables.

> If Time Doctor is not configured, the `td-sync` cron will exit early without error.

---

## Staying Up To Date (Fork Sync Workflow)

When the upstream repository publishes updates:

1. Open your fork on GitHub
2. Click **"Sync fork"** → **"Update branch"**
3. GitHub merges the upstream changes into your fork's `main` branch
4. Vercel detects the new commit and automatically triggers a new deployment

If the update includes a new database migration:

```bash
npx prisma migrate deploy
```

Run this after the Vercel deployment completes.

> **Check release notes** before syncing if you want to understand what changed, especially for migrations.

---

## Custom Domain (Optional)

1. In Vercel project settings → **Domains** → add your domain
2. Follow Vercel's DNS instructions (add CNAME or A record at your registrar)
3. Update these environment variables in Vercel to the new domain:
   - `BETTER_AUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
   - If you had explicitly set `XERO_REDIRECT_URI`, update that too — otherwise it's derived automatically from `NEXT_PUBLIC_APP_URL`
4. Update the redirect URI registered in your Xero developer app to match the new domain (Xero rejects requests from an unregistered redirect URI)
5. Click **Redeploy** (no code changes needed — just env var update)

---

## Local Development

```bash
git clone https://github.com/YOUR_USERNAME/invoice-portal.git
cd invoice-portal
npm install
cp .env.example .env.local   # fill in your own values — never commit this file
npx prisma migrate dev --name init
npm run dev
```

> **Security:** The `.env` file in the repo may contain the original owner's credentials. Always use `.env.local` for your own values and ensure it is listed in `.gitignore` (it is by default in Next.js).

Open [http://localhost:3000](http://localhost:3000).

For local dev, set:
```env
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Troubleshooting

### Build fails: "Cannot find module '@prisma/client'"
The `build` script runs `prisma generate` automatically. If this fails, check that `DATABASE_URL` is set correctly in Vercel environment variables.

### Migrations fail: "P1001 Can't reach database server"
Make sure you're using `DIRECT_URL` (not `DATABASE_URL`) for migrations. The pooled URL does not support DDL operations.

### Auth errors after changing domain
`BETTER_AUTH_URL` must exactly match the domain users are accessing. After changing domains, update this variable and redeploy.

### Xero sync fails after re-deployment
Xero tokens are stored in the database. They should persist across deployments. If you see OAuth errors, re-connect Xero from **Settings → Integrations**.

### First user is not admin
This can happen if there are leftover rows in the `User` table (e.g. from a previous test). Delete all users via Prisma Studio or `psql` and register again.
