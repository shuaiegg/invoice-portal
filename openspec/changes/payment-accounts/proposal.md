## Why

Worker payment details are currently stored as loose fields on the `Worker` model (bank name, SWIFT, PayPal email, crypto wallet, etc.), making it impossible to represent multiple accounts or clearly signal which one should be used. Finance and payments teams must infer the correct channel from whichever fields happen to be filled in, which causes errors and requires manual clarification.

## What Changes

- **New `PaymentAccount` table** replaces the scattered payment fields on `Worker`. Each worker can manage multiple named accounts.
- Each account has a **type** (Bank Transfer, Wise, PayPal, Crypto, Revolut) that controls which fields are shown and required.
- Workers can designate one account as **preferred**; the portal enforces exactly one preferred account per worker.
- **Profile UI** is redesigned: workers add/edit/remove accounts through a card-based list with type-aware field forms instead of a single long form with all fields always visible.
- **Admin worker detail** surfaces the preferred account prominently so the payments team sees the correct channel at a glance.
- **BREAKING**: The legacy flat payment fields on `Worker` (`paymentMethod`, `paymentAccount`, `bankName`, `swiftCode`, `postCode`, `secondaryPayment`, `paypalEmail`, `cryptoCoin`, `cryptoNetwork`, `cryptoWallet`) are deprecated and will be removed in a follow-up migration once data is migrated.

## Capabilities

### New Capabilities

- `payment-account-management`: Workers can create, edit, delete, and reorder payment accounts. Each account has a type, an optional label, type-specific detail fields, and an `isPreferred` flag. Exactly one account per worker may be preferred at a time.

### Modified Capabilities

- `worker-profile`: Profile page gains a dedicated "Payment Methods" section that replaces the current flat payment fields with the new account management UI.

## Impact

- **Database**: New `PaymentAccount` table + migration. Legacy `Worker` payment columns remain for now (backward compat); removal is a follow-on task.
- **API**: New `/api/payment-accounts` CRUD routes. Admin worker GET response adds `paymentAccounts` relation.
- **UI**: `components/worker/profile-form.tsx` payment section rewritten. `components/admin/admin-worker-detail.tsx` updated to show preferred account.
- **No impact on**: invoices, Xero sync, Time Doctor, Wise, n8n, or BetterAuth.

## Non-goals

- Migrating existing flat-field data into the new table (follow-on task).
- Removing legacy Worker payment columns (follow-on task after migration).
- Using payment account details for automated Wise payment routing (Phase 3).
- Validating account details against external services (e.g., IBAN checksum, wallet address format).
