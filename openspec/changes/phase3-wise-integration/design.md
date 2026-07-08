## Context

Wise exposes a 4-step REST API: quote → recipient → transfer → fund. The portal interacts with steps 1–3 synchronously during batch initiation. Step 4 (fund) either happens immediately (Mode B) or is deferred to Lorena's manual approval in the Wise dashboard (Mode A). Payment confirmation arrives via Wise webhook (`outgoing_payment_sent`), regardless of mode.

Key constraint: Wise API-created transfer approval in Wise UI (Mode A) must be verified against the actual Business account before relying on it — this is an open question confirmed in the Wise docs but dependent on account tier.

## Goals / Non-Goals

**Goals:**
- Create Wise transfers atomically with full audit trail
- Support both manual-approval (Mode A) and auto-fund (Mode B) without code changes
- Webhook-driven PAID marking — no polling
- Sandbox/production toggle for safe testing

**Non-Goals:**
- Revolut, crypto, or PayPal API integration (remain manual in this phase)
- Automatic retry on failed transfers (manual re-initiation required)
- Multi-currency within a single batch (all invoices in a batch use the same source currency)

## Decisions

**customerTransactionId = invoiceId for idempotency**
Pass `invoiceId` as `customerTransactionId` in the Wise transfer creation. This gives idempotency (Wise rejects duplicate IDs) and makes webhook-to-invoice matching trivial — no secondary lookup needed.

**Store wiseTransferId on Invoice**
After Step 3 (transfer created), store `wiseTransferId` on the invoice. Allows admins to deep-link to the transfer in Wise dashboard and enables manual reconciliation if webhook is missed.

**Mode stored in WiseConfig, not per-run**
Payment mode is an account-level setting. Changing it mid-cycle requires admin intent. Storing per-run would allow accidental mode mixing; account-level config is safer.

**Webhook endpoint at /api/webhooks/wise (no auth middleware)**
BetterAuth middleware protects all routes except `(auth)` group. Wise webhooks cannot carry a session cookie. The endpoint must be explicitly excluded from auth middleware and secured by HMAC signature verification instead.

**Rate limiting: 1 transfer per second**
Wise allows ~40 req/sec, but for safety and to avoid hitting recipient creation limits, process one transfer per second with a delay loop. 200 transfers = ~3.5 minutes — acceptable for a background batch.

## Risks / Trade-offs

- **Mode A — Wise UI approval not confirmed**: We assume Wise Business allows API-created transfers to appear in the approval queue. If not, Mode A falls back to manual portal marking. Mitigation: test with sandbox Business account before production launch.
- **Webhook missed**: If the webhook fails to deliver, the invoice stays in `PAYMENT_PENDING` forever. Mitigation: add a daily reconciliation check (Phase 4) that polls transfer status for any PAYMENT_PENDING invoices older than 24h.
- **Recipient account re-creation**: Wise recipient accounts may already exist in the Wise profile. Creating a duplicate is harmless (Wise deduplicates by IBAN) but wastes API calls. Mitigation: cache `wiseRecipientId` on Worker after first creation.

## Migration Plan

1. Add `WiseConfig`, `PaymentRun`, `PaymentRunItem` models; migrate
2. Admin configures Wise in sandbox mode → registers webhook → runs a test batch with 1 invoice
3. Verify webhook receipt and PAID marking in sandbox
4. Switch to production mode; run first real batch with 5 invoices as pilot
5. Full rollout after pilot verified

## Open Questions

- Does the Wise Business account support Mode A (API-created transfers held for UI approval)? → Verify with Lorena/Wise support before Phase 3 kickoff
- Should the portal store Wise API key encrypted in DB or rely on environment variable? (DB allows UI config; env var is simpler but requires redeploy to change)
