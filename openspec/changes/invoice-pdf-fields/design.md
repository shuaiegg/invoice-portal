## Worker Schema Extension

Four nullable columns added to `Worker` model:

```prisma
model Worker {
  // ... existing fields ...
  bankName          String?   // e.g. "PING AN BANK CO.,LTD"
  swiftCode         String?   // e.g. "SZDBCNBS"
  postCode          String?   // e.g. "518000"
  secondaryPayment  String?   // free text, e.g. "AliPay: 86-13424371741 / user@email.com"
}
```

All four are optional — existing workers unaffected. Profile completeness gate does not change (still checks name/address/city/country/paymentMethod).

## Invoice Currency

`Invoice.currency` already exists in the schema (`String @default("EUR")`). The only code change is:
1. `new-invoice-form.tsx` — add a `<Select>` for currency, replace the hardcoded `"EUR"` default with `"USD"`
2. `invoice-detail.tsx` — change `formatCurrency` to use `invoice.currency` instead of hardcoded `"EUR"`

`formatCurrency` becomes:
```ts
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: invoice.currency || "USD",
  }).format(amount);
```

## "Billed To" Company Block

Sourced entirely from env vars — no DB model needed since the client is globally fixed (ITACWT Limited):

```
NEXT_PUBLIC_COMPANY_NAME=ITACWT Limited
NEXT_PUBLIC_COMPANY_VAT=IE3450340QH
NEXT_PUBLIC_COMPANY_ADDRESS=2 Cruise Park Rise, Tyrrelstown
NEXT_PUBLIC_COMPANY_CITY=Dublin 15
NEXT_PUBLIC_COMPANY_COUNTRY=Ireland
```

Fallback strings shown if env vars not set, so local dev doesn't break.

## PDF Layout

Target layout matching contractor invoice format:

```
┌────────────────────────────────────────────────────────────┐
│                                               INVOICE      │
│                                               #INV-2026-008│
├────────────────────────────────────────────────────────────┤
│ BILLED TO                                                  │
│ [COMPANY_NAME]    VAT No. [COMPANY_VAT]                    │
│ [COMPANY_ADDRESS]                                          │
│ [COMPANY_CITY], [COMPANY_COUNTRY]                          │
│                                                            │
│ PAY TO                                                     │
│ [worker.name]                                              │
│ [worker.address], [worker.postCode]                        │
│ [worker.city], [worker.country]                            │
│ [worker.vatNumber if set]                                  │
│                                                            │
│ Bank:    [worker.bankName]                                 │
│ SWIFT:   [worker.swiftCode]                                │
│ Account: [worker.paymentAccount]                           │
│ [worker.secondaryPayment]       ← only shown if filled     │
├────────────────────────────────────────────────────────────┤
│ DESCRIPTION          │  RATE  │  QTY   │  AMOUNT           │
│ [invoice.description]│[rate]  │[qty]   │ USD 1,606.50       │
├────────────────────────────────────────────────────────────┤
│                                  TOTAL: USD 1,606.50       │
└────────────────────────────────────────────────────────────┘
```

Key differences from current layout:
- Company moves from top-right header → explicit "BILLED TO" left-aligned section
- "From" → "PAY TO"
- Invoice number shown in top-right header alongside "INVOICE" title
- Banking details (bankName, SWIFT, postCode) appear in PAY TO section
- secondaryPayment shown on its own line if present
- VAT subtotal row only shown when vatRate > 0 (unchanged)
- Currency symbol follows `invoice.currency` (not hardcoded EUR)

## Profile Form Layout

New "Banking Details" card section after existing "Payment Details":

```
┌─ Payment Details ────────────────────────────────────┐
│ Payment Method     │  Account Number / IBAN           │
│ (Bank Transfer)    │  (623058 0000279805746)          │
├──────────────────────────────────────────────────────┤
│ Bank Name                    │  SWIFT / BIC Code     │
│ (PING AN BANK CO.,LTD)       │  (SZDBCNBS)           │
│                                                      │
│ Post Code                                            │
│ (518000)                                             │
│                                                      │
│ Secondary Payment Method (Optional)                  │
│ e.g. AliPay: 86-13424371741 / email@example.com      │
└──────────────────────────────────────────────────────┘
```

`secondaryPayment` uses a `<Textarea>` or single `<Input>` — free text so workers can write any format (AliPay, Wise, PayPal, etc.).

## Invoice Form Currency Selector

Placed in the Summary card alongside Invoice Date:

```
┌─ Summary ────────────────────┐
│ Invoice Date  [2026-06-17]   │
│ Currency      [USD ▾]        │  ← new: USD / EUR / GBP
├──────────────────────────────┤
│ Subtotal      1,606.50       │
│ Total         1,606.50       │
└──────────────────────────────┘
```

Options: `USD`, `EUR`, `GBP`. Default `USD`. Uses shadcn `<Select>`.
