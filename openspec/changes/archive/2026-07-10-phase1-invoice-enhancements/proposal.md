## Why

The current portal handles basic invoice submission but lacks the data fields and features the finance team needs to process all payment types. Before Time Doctor automation (Phase 2) can begin, the Worker profile and invoice model must support payment routing, multiple compensation types, deductions, and notification hooks that the payments team relies on daily.

## What Changes

- **Worker profile**: Add `paymentType` enum (`td_only | td_plus | manual`) to classify automation routing; add `timeDoctorEmail` for TD matching; add crypto payment fields (`cryptoCoin`, `cryptoNetwork`, `cryptoWallet`) and `paypalEmail`
- **Invoice line items**: Replace single-amount invoice with multi-line model — each line has description, quantity, unit rate, and amount; negative amounts represent deductions
- **Slack notifications**: Fire on invoice creation (to #finance), on every status change (to #finance), and on PAID for manual-payment invoices (to the worker)
- **Invoice schema migration**: `InvoiceLine` child table, `Invoice.totalAmount` derived from lines sum; existing single-amount invoices migrated to a single line item

## Capabilities

### New Capabilities
- `invoice-line-items`: Multi-line invoice model with deductions support — workers can add/remove lines, each with description, quantity, rate; negative lines are deductions
- `worker-payment-profile`: Extended worker profile fields for payment routing type, Time Doctor email override, crypto wallet details, and PayPal email
- `invoice-notifications`: Slack notification events for invoice lifecycle — creation, status transitions, and paid confirmation to workers

### Modified Capabilities
- `invoice-submission`: Invoice submission flow changes to require at least one line item; total is computed server-side from lines; edit/revoke flow must handle line item updates

## Impact

- **Database**: New `InvoiceLine` table; `Invoice` loses `amount`/`description` direct fields (or keeps them as computed); `Worker` gains 7 new fields
- **APIs**: `POST /api/invoices` and `PUT /api/invoices/[id]` accept `lines[]` array; `GET` responses include lines
- **UI**: Invoice create/edit form replaced with dynamic line-item builder; worker profile form extended
- **Slack**: `lib/slack.ts` extended with new event types
- **Non-goals**: No Time Doctor sync, no Wise integration, no Xero schema changes, no role/permission changes
