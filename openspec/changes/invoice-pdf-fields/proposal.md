## Why

Worker invoices currently lack several fields that appear on real contractor invoices: SWIFT code, bank name, post code, and secondary payment method (e.g. AliPay). The PDF template also has layout and data bugs — the "Billed To" company section is not labeled, and currency formatting is hardcoded to EUR even when a worker invoices in USD or GBP. This change aligns the generated PDF with the actual invoice format used by contractors.

## What Changes

- Worker schema: add `bankName`, `swiftCode`, `postCode`, `secondaryPayment` fields
- Profile form: structured banking section with dedicated inputs for each new field
- Invoice PDF template (`invoice-detail.tsx`): restructure layout to match real invoice format — explicit "BILLED TO" and "PAY TO" sections, display all banking fields, fix currency formatting to use `invoice.currency`
- Invoice submission form: currency selector (USD / EUR / GBP, default USD)
- Profile API: accept and persist the four new Worker fields
- Env vars: document required `NEXT_PUBLIC_COMPANY_*` values for the "Billed To" block

## Capabilities

### New Capabilities

- `worker-banking-details`: Structured banking profile with dedicated fields for bank name, SWIFT/BIC code, account number, post code, and an optional secondary payment method (free text, e.g. "AliPay: 86-134... / email@example.com"). All fields optional but shown on the invoice PDF when filled.

### Modified Capabilities

- `worker-profile`: Extended with `bankName`, `swiftCode`, `postCode`, `secondaryPayment`. Profile completeness check unchanged (only name/address/city/country/paymentMethod gated).
- `invoice-pdf-print`: Layout restructured to match contractor invoice format. Company block labeled "BILLED TO" (sourced from `NEXT_PUBLIC_COMPANY_*` env vars). Worker block labeled "PAY TO". Banking section shows bankName, SWIFT, account number, post code, and secondaryPayment. Currency display uses `invoice.currency` field (fixes EUR hardcode bug).
- `invoice-submission`: Currency field now accepts `USD | EUR | GBP`, defaults to `USD`.

## Impact

- **DB migration required**: `prisma migrate dev` — adds 4 nullable columns to `Worker` table, no data loss
- **Env vars required**: `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_VAT`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_COMPANY_CITY`, `NEXT_PUBLIC_COMPANY_COUNTRY` must be set in `.env.local` and Vercel
- **Modified files**: `prisma/schema.prisma`, `lib/generated/client/*`, `app/api/profile/route.ts`, `components/worker/profile-form.tsx`, `components/worker/invoice-detail.tsx`, `components/worker/new-invoice-form.tsx`
- **No API contract change**: webhook payload already includes `invoice.currency`; n8n workflows receive the correct currency with no changes needed
