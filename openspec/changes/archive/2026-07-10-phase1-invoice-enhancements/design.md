## Context

The current `Invoice` model stores a flat `amount` and `description`. The finance team needs multiple compensation types and deductions on a single invoice. Phase 1 extends the data model before Phase 2 automation depends on it, minimising breaking changes later.

Current state: `Invoice { amount, description, status, workerId, ... }` — one amount per invoice, no line item concept.

## Goals / Non-Goals

**Goals:**
- Introduce `InvoiceLine` child table; make `Invoice.totalAmount` derived
- Extend `Worker` with 7 new profile fields without breaking existing workers
- Fire Slack notifications at invoice lifecycle events without blocking submissions
- Migrate all existing invoice records to single-line format

**Non-Goals:**
- Time Doctor or Wise integration (Phase 2/3)
- Xero line-item sync (Xero receives only the invoice total for now)
- Currency per line item (all lines on one invoice share the invoice currency)
- Approval workflow changes

## Decisions

**InvoiceLine as a separate table (not JSONB)**
Relational rows allow filtering, aggregation, and future reporting by line type. JSONB would be simpler but opaque to SQL queries. Prisma handles the relation cleanly.

**totalAmount stored as computed-on-write, not a DB computed column**
Neon/PostgreSQL supports generated columns but Prisma 7 does not yet expose them. Instead, the API computes the sum and writes `totalAmount` on every create/update. Ensures the field is always available for `ORDER BY` and filtering without runtime aggregation.

**Atomic line replacement on edit**
PUT replaces all lines in a transaction: delete existing, insert new. Avoids partial-update complexity and merge conflicts. Acceptable because edits are infrequent (pre-approval only).

**paymentType default: `manual`**
Safe default — all existing workers remain on manual flow until explicitly classified. Prevents accidental TD automation on workers not yet set up.

**Slack notifications: fire-and-forget**
Notifications use `lib/slack.ts` which wraps `fetch` without `await` in the hot path (or awaits but catches and logs without re-throwing). Invoice submission must not fail because Slack is down.

## Risks / Trade-offs

- **Migration irreversibility**: Once `Invoice.amount` is removed and migrated to `InvoiceLine`, rollback requires a reverse migration. Mitigation: keep `amount` as a nullable shadow column for one deploy cycle, then remove in a follow-up migration.
- **Xero sync now sends only totalAmount**: Xero bill lines will not match invoice lines until a future change. Acceptable for Phase 1 — finance team confirmed Xero only needs the total for now.
- **PDF layout change**: The print template (`/invoice/[id]`) must render a line-items table. Mitigation: update the template in the same PR.

## Migration Plan

1. Add `InvoiceLine` table and new `Worker` fields via `prisma migrate dev`
2. Run data migration script: for each existing `Invoice`, insert one `InvoiceLine` with `description = invoice.description`, `quantity = 1`, `unitRate = invoice.amount`; set `invoice.totalAmount = invoice.amount`
3. Deploy — old `Invoice.amount` field kept nullable during transition
4. Follow-up migration (next PR): remove `Invoice.amount` and `Invoice.description` legacy columns

## Open Questions

- Should line item `description` have a max length enforced? (Suggest 500 chars)
- Xero line-item sync: deferred to a future change or Phase 3?
