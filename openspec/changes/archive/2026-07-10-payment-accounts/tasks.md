## 1. Database Schema

- [x] 1.1 Add `PaymentAccountType` enum to `prisma/schema.prisma` (BANK_TRANSFER, WISE, PAYPAL, CRYPTO, REVOLUT)
- [x] 1.2 Add `PaymentAccount` model with fields: id, workerId, type, label, isPreferred, accountNumber, bankName, swiftCode, email, cryptoCoin, cryptoNetwork, cryptoWallet, createdAt, updatedAt
- [x] 1.3 Add `paymentAccounts PaymentAccount[]` relation to `Worker` model
- [x] 1.4 Run `npx prisma migrate dev --name add-payment-accounts`
- [x] 1.5 Run `npx prisma generate` to regenerate client

## 2. API — Worker CRUD Routes

- [x] 2.1 Create `app/api/payment-accounts/route.ts` — GET (list worker's accounts) and POST (create account)
- [x] 2.2 Create `app/api/payment-accounts/[id]/route.ts` — PUT (update) and DELETE (delete)
- [x] 2.3 Create `app/api/payment-accounts/[id]/prefer/route.ts` — POST (set as preferred, atomic swap via transaction)
- [x] 2.4 Add server-side required-field validation per type (422 on missing required fields)
- [x] 2.5 Scope all routes to session.user → worker; return 403 if account belongs to a different worker

## 3. API — Admin Read

- [x] 3.1 Include `paymentAccounts` (ordered: preferred first, then createdAt) in `GET /api/admin/workers/[id]` response

## 4. UI — Payment Account Component

- [x] 4.1 Create `components/worker/payment-account-list.tsx` — card list showing existing accounts with preferred badge, edit and delete buttons
- [x] 4.2 Create `components/worker/payment-account-form.tsx` — Sheet (slide-over) with type selector and dynamic fields per type; used for both add and edit
- [x] 4.3 Implement type-specific field visibility in the form (BANK_TRANSFER shows accountNumber/bankName/swiftCode; WISE/PAYPAL/REVOLUT shows email; CRYPTO shows cryptoCoin/cryptoNetwork/cryptoWallet)
- [x] 4.4 Add empty state with "Add Payment Method" button when worker has no accounts
- [x] 4.5 Show legacy-data banner if Worker still has populated flat payment fields but no PaymentAccount rows

## 5. UI — Profile Page Integration

- [x] 5.1 Replace the payment fields section in `components/worker/profile-form.tsx` with `<PaymentAccountList>` component
- [x] 5.2 Pass payment accounts as a prop (fetched server-side in `/app/(worker)/profile/page.tsx`)
- [x] 5.3 Remove the now-unused fields from the profile form's `profileData` object: paymentMethod, paymentAccount, bankName, swiftCode, postCode, secondaryPayment, paypalEmail, cryptoCoin, cryptoNetwork, cryptoWallet

## 6. UI — Admin Worker Detail

- [x] 6.1 Update `components/admin/admin-worker-detail.tsx` to display preferred PaymentAccount (type badge + key detail) instead of legacy `worker.paymentMethod` text
- [x] 6.2 Show "No preferred account set" notice if worker has accounts but none is preferred
- [x] 6.3 Show "No payment accounts added" if worker has no accounts at all

## 7. Verification

- [x] 7.1 Run `npm run build` — confirm no TypeScript or build errors
- [x] 7.2 Manual flow — worker: add a Bank Transfer account, set it as preferred, verify preferred badge appears
- [x] 7.3 Manual flow — worker: add a Crypto account, verify only Coin/Network/Wallet fields are shown
- [x] 7.4 Manual flow — worker: delete the preferred account, verify no account becomes preferred
- [x] 7.5 Manual flow — admin: open a worker detail page, verify preferred account is shown correctly
- [x] 7.6 Manual flow — worker: attempt to submit with missing required field, verify 422 error message
