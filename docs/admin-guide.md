# Admin Guide

This guide covers all admin-facing features of the Worker Invoice Portal.

---

## Navigation

The admin panel is accessible at `/admin`. The sidebar contains:

- **Dashboard** — key metrics and recent activity
- **Invoices** — full invoice management
- **Workers** — worker profiles and payment setup
- **Automation** — TD sync runs and anomaly flags
- **Audit Log** — record of all admin actions
- **Settings** — integrations, users, and portal configuration

A **My Invoices** button appears in the bottom-right corner if your account also has a linked worker profile, allowing you to switch to the worker view without losing your admin session.

---

## Dashboard

Shows at a glance:
- Total invoices by status (Draft, Submitted, Approved, Paid, Void)
- Recent invoice activity
- Pending items requiring attention (e.g. unresolved TD match failures)

---

## Managing Invoices

### Invoice List (`/admin/invoices`)

- **Filter by status**: use the status checkboxes (Draft, Submitted, Approved, Paid, Void) or the Xero filter
- **Filter by billing month**: select a month from the dropdown to see only that month's invoices
- **Filter by worker name or period**: use the search fields
- **Channel tabs**: switch between All / Wise / PayPal / Manual to segment by payment method
- **Stats bar**: shows total invoice count and currency breakdown for the current filter; updates to show selected count and totals when invoices are checked
- **Export CSV**: downloads filtered invoices as a CSV file

### Changing Invoice Status

**Single invoice**: click the invoice row to open the detail page, then use the status action buttons (Approve, Mark Paid, Void, etc.).

**Bulk operations**: check multiple invoices in the list, then use the bulk action bar that appears at the bottom. Available bulk actions depend on the current status of selected invoices:
- Submitted → Approved
- Approved → Paid (also triggers Xero sync for each invoice)
- Any status → Void

> **Before bulk Mark Paid**: review the stats bar to confirm the total amount for the selected invoices. This is the amount that will be processed for payment.

### Xero Sync

Xero sync happens automatically when an invoice is marked **Paid** — either individually or in bulk. If sync fails:
- The invoice reverts to **Approved**
- The admin sees the error message
- A **Retry Xero Sync** button appears on the invoice detail page

Invoices that failed Xero sync are visible via the **Xero: Failed** filter in the invoice list.

### Voiding Invoices

Voided invoices remain in the system for audit purposes. They are excluded from totals and cannot be re-activated. If a worker needs to resubmit, ask them to create a new invoice.

---

## Managing Workers (`/admin/workers`)

### Worker Profiles

Each worker has a profile with:
- Personal details (name, address, country)
- Payment configuration (method, account details, currency)
- Time Doctor email (for automatic matching during TD sync)
- Hourly rate and rate source (TD import or manually set)

### Adding Workers

Workers can self-register via `/register` (if registration is open) and complete their profile. Alternatively:
- Use **Import Workers** (CSV) on the Workers page to bulk-create profiles
- Workers can be linked to an existing user account or exist as profile-only (for TD sync matching) until they register

### Worker Claim Links

If a worker profile exists before the worker registers, generate a **Claim Link** from the worker detail page. Share this link with the worker — clicking it links their new account directly to the existing profile without requiring admin intervention.

### Payment Channels

Workers are categorised into three payment channels based on their payment accounts:
- **Wise** — workers with a linked Wise account
- **PayPal** — workers with a PayPal email on file
- **Manual** — all other workers (bank transfer, crypto, etc.)

This is used to filter invoices by payment method and helps organise the payment run.

### Importing Workers (CSV)

The CSV import creates or updates worker profiles in bulk. If an imported hourly rate conflicts with the rate already in the portal, a **Rate Conflict** is recorded. Resolve conflicts from the Workers page → Rate Conflicts tab.

---

## Time Doctor Sync (`/admin/automation`)

### Manual Sync

Click **Run TD Sync** to trigger an immediate sync for the previous month. The sync:
1. Fetches hours from Time Doctor for all workers
2. Matches TD users to portal workers by email
3. Creates draft invoices for matched workers
4. Records match failures for unmatched TD users

### Match Failures

Workers who appear in Time Doctor but couldn't be matched to a portal profile are listed as **Match Failures**. For each failure you can:
- **Link to existing worker** — if the TD email differs from the portal email
- **Create worker** — create a new worker profile and link it
- **Ignore** — add the TD email to the ignore list (useful for non-worker TD accounts like company owners)

### Anomaly Flags

After each sync, the system runs anomaly detection and flags invoices that:
- **Hour deviation**: hours deviate >20% from the worker's 3-month average
- **Amount ceiling**: total invoice amount exceeds €10,000
- **Missing TD data**: TD_ONLY workers with no hours recorded

Flagged invoices appear on the Automation page for review. Anomalies are informational — they do not block invoice approval.

---

## Audit Log (`/admin/audit`)

Every admin status change is recorded:
- **Invoice status changes** — who changed which invoice, from/to which status
- **Bulk operations** — flagged with `bulk: true`
- **User role changes** — who promoted/demoted which user

Logs are append-only and cannot be deleted. Use the action filter to narrow down by event type.

---

## Settings

### General (`/admin/settings`)

- **Worker Registration**: toggle open/closed. Close registration once all workers are onboarded to prevent unauthorised sign-ups.

### Users (`/admin/settings/users`)

- Promote workers to Admin or demote admins to Worker
- Role changes take effect within 5 minutes (due to session cookie cache)
- Deactivate accounts to prevent login without deleting data

### Xero (`/admin/settings/xero`)

- Connect or reconnect the Xero OAuth integration
- View connection status and token expiry
- Xero tokens refresh automatically when within 2 minutes of expiry

### Time Doctor (`/admin/settings/timedoctor`)

- Update TD API credentials (token and company ID)
- Test the connection
- View last sync status

---

## Common Tasks

### Month-end workflow

1. Wait for automatic TD sync (1st of month, 06:00 UTC) **or** trigger manually from `/admin/automation`
2. Review match failures — link or create missing workers
3. Review anomaly flags on any invoices that look unusual
4. Filter invoices by the billing month in `/admin/invoices`
5. Bulk approve all Submitted invoices for the month
6. Confirm payment amounts in the stats bar
7. Process payments via Wise/PayPal/bank transfer
8. Bulk mark Paid — Xero sync triggers automatically

### Handling a disputed invoice

1. Find the invoice and set status to **Void**
2. Ask the worker to submit a corrected invoice
3. Approve and pay the new invoice

### Worker not appearing in TD sync

1. Go to `/admin/automation` → Match Failures
2. Find the worker's TD email in the failure list
3. Click **Link to worker** and select the correct portal profile
4. Re-run the sync (or wait for next month)
