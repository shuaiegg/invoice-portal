# Wise Platform API Reference

Source: https://docs.wise.com/
Last verified: 2026-07-07

This document captures the Wise API facts relevant to Invoice Portal. It is not a full Wise API reference.

## Integration Boundary

- Invoice Portal calls Wise directly.
- n8n is not used for Wise quotes, recipients, transfers, funding, webhooks, or payment status updates.
- n8n may receive notification-only events after Portal has already recorded the financial state change.
- Portal is the source of truth for payment runs, payment records, invoice status, audit logs, and Wise webhook processing.

## Environments

- Sandbox base URL: `https://api.wise-sandbox.com`
- Production base URL: `https://api.wise.com`

Do not use legacy sandbox domains in new code.

## Authentication Notes

Wise supports multiple auth models. Before implementation, run a dedicated Wise spike against the actual business account.

### Personal API Token

- Sent as `Authorization: Bearer {token}`.
- Useful for early sandbox testing and some business-account automation.
- May be limited by region/account type.
- EU/UK PSD2 restrictions can limit sensitive actions such as funding transfers or balance access.

### OAuth / Partner Credentials

- More appropriate for production-grade automation if personal token limits block funding, balance reads, or batch payment flows.
- Requires more setup but gives a cleaner long-term security model.

## Standard Transfer Flow

The single-transfer API flow is:

```text
profile -> quote -> recipient account -> transfer -> payment/funding
```

### 1. Get Profile ID

```http
GET /v1/profiles
Authorization: Bearer {token}
```

Returns one or more Wise profiles. Store the selected business `profileId` in Portal settings.

### 2. Create Quote

```http
POST /v3/profiles/{profileId}/quotes
Content-Type: application/json

{
  "sourceCurrency": "EUR",
  "targetCurrency": "EUR",
  "sourceAmount": 1040.00,
  "targetAmount": null,
  "payOut": "BANK_TRANSFER"
}
```

Notes:
- A quote is tied to one transfer flow.
- A quote cannot be reused indefinitely for retries.
- Quote expiry and rate changes must be handled explicitly.

### 3. Create Or Reuse Recipient Account

```http
POST /v1/accounts
Content-Type: application/json

{
  "currency": "EUR",
  "type": "iban",
  "profile": {profileId},
  "accountHolderName": "Worker Name",
  "details": {
    "legalType": "PRIVATE",
    "iban": "..."
  }
}
```

Recipient creation is the hardest part of Wise integration because required fields vary by country, currency, and recipient type.

Portal requirements:
- Store a cached `wiseRecipientId` on the worker or a dedicated recipient table.
- Invalidate cached recipient details when worker bank/payment fields change.
- Keep country/currency-specific validation out of ad hoc string checks.

### 4. Create Transfer

```http
POST /v1/transfers
Content-Type: application/json

{
  "targetAccount": "{accountId}",
  "quoteUuid": "{quoteId}",
  "customerTransactionId": "{invoice-or-payment-run-item-id}",
  "details": {
    "reference": "INV-2026-0012",
    "transferPurpose": "verification.transfers.purpose.pay.bills"
  }
}
```

Idempotency:
- Use a stable `customerTransactionId`.
- Prefer `PaymentRunItem.id` rather than `invoice.id` once batch payment records exist.
- Reuse the same idempotency key when retrying the same intended payment.
- Do not blindly retry with new ids after ambiguous failures.

### 5. Fund Transfer

```http
POST /v3/profiles/{profileId}/transfers/{transferId}/payments
Content-Type: application/json

{
  "type": "BALANCE"
}
```

Funding ability must be verified against the real account and auth mode.

## Batch Payments

The old assumption "Wise has no native batch endpoint" is not safe.

Wise supports Batch Transfers / Batch Groups in the API:
- A batch group can contain many transfers, with documented limits.
- Batch funding may allow funding the group rather than funding each transfer one by one.
- This should be evaluated before choosing a loop-per-worker implementation.

Design requirement:
- Wise Phase must include a spike comparing standard transfers vs batch groups for our account.
- Do not commit to n8n loop-based payment creation; n8n is notification-only.

## Payment Approvals Risk

The earlier Mode A idea was:

```text
Portal creates Wise transfers -> Lorena approves in Wise UI -> Wise webhook marks paid
```

This must be treated as unverified. Wise Business Payment Approvals may not support transfers created through the API. If approvals are enabled, API-created transfer acceptance can fail because approval is required.

Design requirement:
- Confirm with Wise sandbox/business support whether the company account supports:
  - API-created transfers with manual approval in Wise UI
  - batch group approval
  - API funding from balance
  - webhook events for both approved and API-funded payments
- Until confirmed, Portal must keep a manual payment fallback:
  - Finance pays in Wise/Revolut/Crypto/PayPal externally.
  - Finance records the payment in Portal.
  - Portal syncs accounting/payment status after the local record is saved.

## Transfer Status And Webhooks

### Check Transfer Status

```http
GET /v1/transfers/{transferId}
```

Statuses can include states such as:
- `incoming_payment_waiting`
- `processing`
- `funds_converted`
- `outgoing_payment_sent`

Treat `outgoing_payment_sent` as the useful signal that money left Wise.

### Webhook Subscriptions

```http
POST /v3/profiles/{profileId}/subscriptions
Content-Type: application/json

{
  "name": "Invoice Portal Webhook",
  "trigger_on": "transfers#state-change",
  "delivery": {
    "version": "2.0.0",
    "url": "https://your-app.vercel.app/api/webhooks/wise"
  }
}
```

Portal webhook handler requirements:
- Wise webhooks must hit Portal directly.
- Verify `X-Signature-SHA256` using Wise's public-key signature scheme.
- Return a 2xx response within Wise's timeout window.
- Make processing idempotent because Wise retries failed deliveries.
- Record raw event metadata for audit/debugging.
- Never let n8n mark invoices paid.

### List Subscriptions

```http
GET /v3/profiles/{profileId}/subscriptions
```

Portal should expose subscription status in Admin settings after Wise integration is built.

## Balance Check

Wise balance APIs should be evaluated during the Wise spike.

Portal requirement:
- Perform a pre-flight balance/funding readiness check before creating a payment run that will be funded by Wise balance.
- If the chosen auth model cannot read balances, the UI must make that limitation explicit and require manual confirmation.

## Portal Design Requirements

1. Wise is Portal-owned, not n8n-owned.
2. Portal stores payment runs, payment run items, Wise ids, local payment records, status transitions, and audit logs.
3. Wise webhook events update Portal only after signature verification and idempotency checks.
4. n8n receives only notification events after Portal has saved state.
5. API payment execution remains behind an explicit Admin/Finance action.
6. Manual payment fallback remains first-class for:
   - developers
   - crypto
   - PayPal
   - external Wise/Revolut flows
   - any region/account limitation
7. Batch group support must be verified before designing one-transfer-per-worker loops.

## Open Questions Before Implementation

- Which Wise business account/profile will be used?
- Is the account in a region where personal-token funding is restricted?
- Are Business Payment Approvals enabled?
- Can API-created transfers be manually approved in the Wise dashboard?
- Does the account support Batch Groups for the intended payout currencies?
- Which currencies/countries/payment rail types are needed for the first production batch?
