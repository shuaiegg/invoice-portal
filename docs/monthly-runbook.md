# Monthly Operations Runbook

Step-by-step guide for the finance team's monthly invoice cycle.

---

## Timeline Overview

| When | What happens | Who |
|------|-------------|-----|
| 1st of month, 06:00 UTC | TD sync cron runs automatically | System |
| 1st–5th | TD_PLUS workers review and submit their draft invoices | Workers |
| 1st–10th | Manual workers submit their invoices | Workers |
| ~10th | Finance reviews and bulk-approves submitted invoices | Admin |
| ~15th | Finance processes payments and bulk marks as paid | Admin |
| 2nd of month, 08:00 UTC | Monthly report cron runs automatically | System |

---

## Step 1 — TD Sync (Automatic)

**Runs automatically** on the 1st of each month at 06:00 UTC via Vercel Cron. No action needed unless it fails.

**After the sync runs**, check:
1. Admin → **Automation** → latest sync run
2. Review any **Match Failures** — TD users who couldn't be matched to a portal worker
3. Review any **Anomaly Flags** — invoices with unusual hours or amounts

**If the sync didn't run or failed:**
- Check Admin → Settings → Time Doctor — the token may need reconnecting
- Run a manual sync: Admin → Automation → **Run TD Sync**
- Check Slack `#finance-ops` for the `td.sync_failed` alert

**Resolving match failures:**
- **Link to existing worker** — if the TD email is different from the portal email
- **Create worker** — creates a new profile and links it; the invoice is created immediately
- **Ignore** — for non-worker TD accounts (company owners, managers, etc.)

---

## Step 2 — Workers Submit Invoices

TD_PLUS workers receive a Slack notification (`td.draft_ready`) when their draft is ready. They review, add any extra items, and submit.

Manual workers (paymentType: MANUAL) submit their invoices independently.

**If a worker hasn't submitted by your deadline:**
- Check their invoice in Admin → Invoices (filter by status: Draft)
- Contact them directly — their email is on the worker detail page

---

## Step 3 — Review and Approve

1. Go to Admin → **Invoices**
2. Filter by **Status: Submitted** and the current billing month
3. Review the stats bar — confirm total count and amount look correct
4. Check any **Anomaly Flags** on individual invoices (visible on the invoice detail page)

**Bulk approve:**
1. Select all submitted invoices (checkbox in header, or select individual ones)
2. Click **Approve** in the bulk action bar
3. Confirm — status changes to Approved, Slack fires `invoice.bulk_completed`

**Single invoice approval:** open the invoice → click **Approve**.

**Requesting changes:**
- Open the invoice → click **Request Changes** → add a note explaining what needs fixing
- The invoice returns to Draft; the worker receives a Slack notification with your note
- Worker resubmits; it reappears in the Submitted queue

---

## Step 4 — Process Payments and Mark Paid

After processing payments through your payment platform (Wise, PayPal, bank transfer):

**Bulk mark paid:**
1. Filter invoices by **Status: Approved** and billing month
2. Use the **Channel tabs** (Wise / PayPal / Manual) to process each payment method separately
3. Select the invoices you've paid
4. Click **Mark Paid** in the bulk action bar
5. Each invoice is synced to Xero automatically as a Draft Bill
6. Slack fires `invoice.paid` for each invoice and `invoice.bulk_completed` at the end

**If Xero sync fails on some invoices:**
- The invoice stays as Paid but `xeroSynced = false`
- Filter by **Xero: Failed** in the invoice list
- Open each failed invoice → click **Retry Xero Sync**

---

## Step 5 — Monthly Report (Automatic)

Runs automatically on the 2nd of each month at 08:00 UTC. Generates a summary of the previous month's invoices. No action needed.

---

## Common Issues

### Worker submitted wrong amount
1. Admin → open the invoice → click **Request Changes** with a note
2. Invoice returns to Draft; worker corrects and resubmits

### Worker needs to cancel a submitted invoice
- Worker can **Revoke** the invoice themselves (only while status is Submitted)
- Or admin can **Void** it from the invoice detail page
- If voided, worker creates a new invoice

### Invoice approved but payment was wrong
- **If not yet marked Paid**: open invoice → Request Changes → worker resubmits
- **If already Paid**: Void the invoice and ask the worker to create a corrected one; handle the payment difference manually

### Xero connection lost
Symptoms: "Xero sync failed" errors on Mark Paid, `AuthenticationUnsuccessful` in error messages.

Fix: Admin → Settings → Xero → **Reconnect Xero** → complete OAuth flow again.

Note: reconnecting to a different Xero organisation clears all cached Xero contact IDs — they are recreated on the next sync automatically.

### Time Doctor token expired
Symptoms: TD sync fails, Slack `td.sync_failed` alert fires.

Fix: Admin → Settings → Time Doctor → re-enter email and password → **Connect**.

Tokens last approximately 1 year. The settings page shows the expiry date and warns when it's approaching.

### Cron didn't run
Vercel Cron runs on Hobby and Pro plans. Check:
- Vercel dashboard → project → **Cron Jobs** tab — shows last run time and status
- If it shows an error, verify `CRON_SECRET` is set correctly in environment variables
- Run manually: Admin → Automation → **Run TD Sync** (for TD sync)
