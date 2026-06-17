## 1. Schema & Migration

- [ ] 1.1 Add `bankName`, `swiftCode`, `postCode`, `secondaryPayment` (all `String?`) to `Worker` model in `prisma/schema.prisma`
- [ ] 1.2 Run `npx prisma migrate dev --name add-worker-banking-fields`
- [ ] 1.3 Run `npx prisma generate` to update the generated client

## 2. Profile API

- [ ] 2.1 Update `app/api/profile/route.ts` PUT handler — include `bankName`, `swiftCode`, `postCode`, `secondaryPayment` in the `data` object passed to `db.worker.update`

## 3. Profile Form

- [ ] 3.1 Add `bankName`, `swiftCode`, `postCode`, `secondaryPayment` to the `ProfileFormProps.initialData` type in `components/worker/profile-form.tsx`
- [ ] 3.2 Add new fields to `formData` state initializer
- [ ] 3.3 Add "Banking Details" section card with inputs: Bank Name, SWIFT/BIC Code (in a 2-col grid), Post Code, Secondary Payment Method (textarea with placeholder "e.g. AliPay: 86-13424371741 / user@email.com")
- [ ] 3.4 Verify: save profile with banking fields → reload → values persisted

## 4. Invoice Detail — PDF Layout Restructure

- [ ] 4.1 Fix `formatCurrency` in `components/worker/invoice-detail.tsx` — replace hardcoded `currency: "EUR"` with `currency: invoice.currency || "USD"`
- [ ] 4.2 Restructure invoice header: move company block to left side as "BILLED TO" labeled section (company name, VAT, address on separate lines)
- [ ] 4.3 Change "From" label → "PAY TO"; add `worker.postCode` to address line (shown only if set)
- [ ] 4.4 Add banking detail lines under PAY TO: Bank name (if set), SWIFT (if set), Account (existing `paymentAccount`), Secondary payment (if set, own line)
- [ ] 4.5 Move invoice number + date to right-side header block alongside "INVOICE" title
- [ ] 4.6 Verify: print preview matches target layout in `design.md`

## 5. Invoice Form — Currency Selector

- [ ] 5.1 Add `currency` to `formData` state in `components/worker/new-invoice-form.tsx`, default `"USD"`
- [ ] 5.2 Add `<Select>` for currency (USD / EUR / GBP) in the Summary card, below Invoice Date
- [ ] 5.3 Verify: select GBP → submit → invoice detail shows £ amounts

## 6. Env Vars

- [ ] 6.1 Add to `.env.local`:
  ```
  NEXT_PUBLIC_COMPANY_NAME=ITACWT Limited
  NEXT_PUBLIC_COMPANY_VAT=IE3450340QH
  NEXT_PUBLIC_COMPANY_ADDRESS=2 Cruise Park Rise, Tyrrelstown
  NEXT_PUBLIC_COMPANY_CITY=Dublin 15
  NEXT_PUBLIC_COMPANY_COUNTRY=Ireland
  ```
- [ ] 6.2 Add same vars to Vercel environment (production)

## 7. Verification

- [ ] 7.1 Go to Profile → fill in bank name, SWIFT, post code, AliPay → Save → reload → all values shown
- [ ] 7.2 Submit new invoice with currency = USD → open detail → amounts display as US$ not €
- [ ] 7.3 Print invoice → PDF shows "BILLED TO: ITACWT Limited" and "PAY TO: [worker name]" with all banking fields
- [ ] 7.4 Worker with no bankName/swiftCode → those lines hidden cleanly on PDF
- [ ] 7.5 `npm run build` — zero TypeScript errors
