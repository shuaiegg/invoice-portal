# Worker Guide

This guide explains how to use the Worker Invoice Portal to submit and track your monthly invoices.

---

## Getting Started

### Creating Your Account

If the portal is open for registration, go to `{APP_URL}/register` and sign up with your work email address.

> If you received a **claim link** from an admin, use that link instead of the standard registration page. The claim link connects your new account directly to your existing worker profile, preserving your payment details and history.

### Setting Up Your Profile

Before submitting your first invoice, complete your profile at **Profile** (top navigation). You will need to provide:

- **Personal details**: full legal name, address, city, country, postcode
- **VAT details**: VAT number and VAT rate (if applicable; enter 0 if not VAT registered)
- **Payment details**: your preferred payment method and account information

Your profile information appears on every invoice you generate, so make sure it is accurate and up to date.

#### Payment Methods

The portal supports the following payment methods:

| Method | What you need to provide |
|--------|--------------------------|
| Wise | Wise account email or account details |
| PayPal | PayPal email address |
| Bank Transfer | Bank name, account number, SWIFT/BIC code |
| Crypto | Coin, network, and wallet address |
| Other | Payment notes describing your arrangement |

You can add multiple payment accounts and set one as preferred.

---

## Submitting an Invoice

Go to **Dashboard** → **New Invoice** (or the **+** button).

### Invoice fields

| Field | Notes |
|-------|-------|
| **Invoice date** | Defaults to today in your local time |
| **Due date** | Set by you; typically 30 days after invoice date |
| **Billing period** | The month you are invoicing for, e.g. "July 2026" |
| **Description** | Brief description of services rendered |
| **Quantity** | Number of hours (or units) worked |
| **Rate** | Your hourly rate (pre-filled from your profile if set) |
| **Currency** | Your invoicing currency (pre-filled from your profile) |
| **VAT** | Auto-calculated from your VAT rate; editable if needed |

The invoice total is calculated automatically. Review all fields before submitting.

### After submitting

Once you click **Submit**, the invoice status changes to **Submitted** and the finance team is notified. You will receive an email confirmation.

Your invoice is now locked for editing — see [Editing or Revoking an Invoice](#editing-or-revoking-an-invoice) below.

---

## Tracking Your Invoices

All your invoices are listed on the **Dashboard**. Each invoice shows its current status:

| Status | Meaning |
|--------|---------|
| **Draft** | Saved but not yet submitted |
| **Submitted** | Sent to finance — awaiting review |
| **Approved** | Finance has approved; payment is being prepared |
| **Paid** | Payment has been processed |
| **Void** | Invoice cancelled — contact finance if this is unexpected |

Click any invoice row to view the full invoice detail.

---

## Downloading Your Invoice as PDF

1. Open the invoice detail page by clicking the invoice in your dashboard
2. Click **Download PDF** in the top-right corner
3. Your browser's print dialog will open — select **Save as PDF** as the destination

The invoice is formatted for print automatically. No additional software is needed.

---

## Editing or Revoking an Invoice

You can only edit an invoice while it is in **Submitted** status. Once finance sets it to **Approved**, the invoice is locked.

To edit a submitted invoice:
1. Open the invoice from your dashboard
2. Click **Revoke** — the invoice returns to Draft status
3. Make your changes
4. Click **Submit** again to resubmit

> Revoking an invoice notifies the finance team. If payment processing has already started, contact finance directly before revoking.

---

## Frequently Asked Questions

**My hourly rate is wrong on the invoice.**
Update your rate in **Profile** before creating the next invoice. For the current invoice, you can manually edit the rate field before submitting. If the invoice is already submitted, revoke it, correct the rate, and resubmit.

**I can't submit a new invoice — I get an error about a duplicate.**
The portal prevents duplicate invoices for the same billing month. If you need to submit a supplementary invoice for the same month, contact an admin — they can adjust the invoice settings to allow it.

**My invoice status changed to Void and I don't know why.**
Contact your admin. Voided invoices appear in your dashboard so you have a record, but they are not paid. You may need to submit a new invoice.

**I don't see a "New Invoice" button.**
Worker registration or invoice submission may be temporarily closed. Contact your admin.

**I submitted an invoice for the wrong month.**
Revoke the invoice (if still in Submitted status), update the billing period, and resubmit. If it has already been Approved, contact finance to void it and ask them to allow a corrected submission.

**When will I be paid?**
Payment timing is determined by your finance team's schedule, not the portal. The portal status changes to **Paid** once payment has been processed. If you have questions about payment timing, contact finance directly.
