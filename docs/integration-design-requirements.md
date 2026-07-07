# Integration Design Requirements

Last updated: 2026-07-07

This document records the integration boundaries that future OpenSpec changes and implementation work must follow.

## Core Decision

Invoice Portal owns all business-critical finance integrations.

```text
Time Doctor -> Portal -> Xero
                    |
                    -> Wise
                    |
                    -> n8n -> Slack/email notifications
```

## Source Of Truth Rules

1. Portal is the source of truth for:
   - invoices
   - invoice status
   - invoice line items
   - review decisions
   - payment runs
   - payment records
   - Wise transfer ids/statuses
   - Xero sync ids/statuses
   - audit logs
2. n8n is not a source of truth for financial state.
3. External services may provide facts, but Portal decides when those facts change invoice/payment state.

## Integration Ownership

| Integration | Owner | Why |
| --- | --- | --- |
| Xero | Portal direct | Accounting writes must be explicit, synchronous where required, and auditable in Portal. |
| Time Doctor | Portal direct | Time data creates draft/base invoice lines and must be idempotent by worker + period. |
| Wise | Portal direct | Payments, webhook verification, idempotency, and audit logs must live with invoice/payment state. |
| n8n | Notification-only | Notification failures must not block invoice, accounting, or payment flows. |

## n8n Boundary

n8n may:

- Send Slack notifications.
- Send email notifications.
- Fan out operational alerts.
- Format human-readable messages from Portal payloads.

n8n must not:

- Create/update Xero records.
- Read Time Doctor to generate invoices.
- Create/fund Wise payments.
- Receive Wise webhook as the payment authority.
- Mark invoices paid.
- Mutate Portal financial state.

## Manual Developer Payment Requirement

The developer workflow confirmed with Nataly/Felipe requires first-class support for adjustments:

```text
Invoice generated
  -> Developer reviews and adds adjustments
  -> Felipe/Finance reviews
  -> Payment is made/recorded
  -> Portal syncs Xero and emits notifications
```

Required behavior:

- Base invoice lines can come from Time Doctor or fixed monthly data.
- Developers can add positive additional compensation lines.
- Developers can add negative deduction lines.
- Each manual adjustment requires a reason/note.
- Felipe/Finance can approve or return for changes.
- Approved invoice totals are locked before payment is recorded.
- Paid status changes require a payment record or verified Wise event.

## OpenSpec Requirements For Future Changes

Any OpenSpec change touching invoice automation, Time Doctor, Wise, Xero, or payment review must include:

1. **Integration boundary section**
   - Confirm which system owns the write.
   - Confirm n8n remains notification-only.
2. **State machine**
   - Include invoice states and allowed transitions.
   - Include who/what can trigger each transition.
3. **Data model impact**
   - Include migrations and backfill/migration strategy.
   - Include idempotency keys and uniqueness constraints.
4. **Permissions**
   - Worker/developer permissions.
   - Felipe/Finance reviewer permissions.
   - Admin permissions.
   - Bookkeeper/read-only permissions if applicable.
5. **Audit**
   - Record actor, action, before/after data, timestamp, and reason.
6. **External API fact check**
   - Cite or link official API docs used for the design.
   - Identify API assumptions that require sandbox/business-account verification.
7. **Failure handling**
   - Include retry, idempotency, partial failure, and manual recovery behavior.

## Known API Facts That Affect Design

### Time Doctor

- No webhook-driven sync for this use case; Portal must poll/schedule.
- Payroll/user/worklog endpoints should be treated as source data, not approval.
- Email search must be followed by exact Portal-side matching.

### Wise

- Sandbox base URL is `https://api.wise-sandbox.com`.
- Batch transfers/batch groups must be evaluated before designing loop-based payment creation.
- Business Payment Approvals may not support API-created transfers; this must be verified before relying on "Portal creates, Wise UI approves".
- Webhook verification uses Wise signature verification, not a shared-secret callback from n8n.

## Immediate Documentation Follow-Ups

- Align `docs/process-overview.html` roadmap language with the notification-only n8n boundary.
- Align older OpenSpec change artifacts or archive superseded changes so new proposals do not inherit stale n8n/Xero assumptions.
- Add a dedicated OpenSpec change for `manual-developer-payment-workflow` before implementation.
