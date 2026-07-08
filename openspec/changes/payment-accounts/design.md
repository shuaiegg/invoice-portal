## Context

Payment details are currently stored as flat columns on the `Worker` model: `paymentMethod`, `paymentAccount`, `bankName`, `swiftCode`, `postCode`, `secondaryPayment`, `paypalEmail`, `cryptoCoin`, `cryptoNetwork`, `cryptoWallet`. This forces all fields to be visible at once regardless of payment type, makes it impossible to represent more than one account per worker, and gives the finance team no explicit signal about which channel to use.

This design introduces a `PaymentAccount` child table with typed, structured fields and a `isPreferred` flag, accessed via new CRUD API routes and a redesigned profile UI section.

No external systems (Xero, Wise, Time Doctor, n8n) are touched. This change is purely internal: data model + portal UI.

## Goals / Non-Goals

**Goals:**
- Workers can manage multiple named payment accounts, each with type-specific fields
- Exactly one account can be marked preferred at a time (atomic swap)
- Admin worker detail surfaces the preferred account clearly
- Legacy flat fields remain in the DB (no data loss) until a follow-on migration

**Non-Goals:**
- Migrating existing flat-field data into PaymentAccount rows
- Removing legacy Worker payment columns
- Using PaymentAccount details for automated Wise routing (Phase 3)
- Validating account details externally (IBAN checksum, wallet address format)
- Admin-side create/edit/delete of payment accounts

## Decisions

### 1. Typed columns vs. JSON `details` field

**Decision**: Use typed columns on `PaymentAccount` rather than a `Json details` field.

**Rationale**: The set of payment types and their fields is small and stable. Typed columns let Prisma enforce non-null constraints per type at the application layer and make fields directly queryable. A JSON column would require runtime parsing and lose type safety.

**Columns**:
```
accountNumber   String?   // bank account / IBAN
bankName        String?
swiftCode       String?
email           String?   // Wise / PayPal / Revolut
cryptoCoin      String?
cryptoNetwork   String?
cryptoWallet    String?
```

### 2. Preferred enforcement: application-level transaction vs. DB constraint

**Decision**: Enforce "at most one preferred per worker" via a Prisma transaction: set all other accounts to `isPreferred = false`, then set the target to `isPreferred = true`.

**Rationale**: PostgreSQL partial unique indexes (`WHERE isPreferred = true`) would work but Neon/pgbouncer transaction-mode pooling makes DDL-level constraint management brittle. The application-layer transaction is simpler and sufficient for the expected concurrent load (one worker editing their own profile).

### 3. API route structure

```
GET    /api/payment-accounts           → list worker's accounts
POST   /api/payment-accounts           → create account
PUT    /api/payment-accounts/[id]      → update account
DELETE /api/payment-accounts/[id]      → delete account
POST   /api/payment-accounts/[id]/prefer → set as preferred
```

All routes authenticate via BetterAuth session and scope to `session.user → worker`. Workers cannot access other workers' accounts. Admin read access comes through the existing `/api/admin/workers/[id]` route (include `paymentAccounts` in the response).

### 4. Profile UI: inline sheet vs. separate page

**Decision**: Use a shadcn `Sheet` (slide-over panel) for add/edit forms within the profile page. No separate route needed.

**Rationale**: The form is short (4–6 fields depending on type). A sheet keeps the user in context, avoids a navigation round-trip, and matches the pattern used elsewhere in the portal for quick edits. The account list remains visible behind the sheet.

### 5. Type-specific field visibility

**Decision**: The add/edit form uses a `type` selector as the first field. Selecting a type immediately shows only the relevant fields (React `useState` driven). Required fields are validated client-side before submission and server-side in the API handler.

```
BANK_TRANSFER → accountNumber (required), bankName, swiftCode, label
WISE          → email (required), label
PAYPAL        → email (required), label
CRYPTO        → cryptoCoin, cryptoNetwork, cryptoWallet (all required), label
REVOLUT       → email (required), label
```

## Risks / Trade-offs

- **Legacy data gap**: Workers who had flat-field payment data will see an empty Payment Methods section until they re-enter their details. This is acceptable for the first rollout to a small contractor group; a data-migration task should follow before the portal scales.
  → Mitigation: Show a banner on the profile page if legacy fields are populated but no PaymentAccount rows exist, prompting the worker to re-enter their details.

- **No preferred = finance team confusion**: A worker may add accounts without setting a preferred one.
  → Mitigation: Admin worker detail clearly shows "No preferred account set" if none is marked.

- **Sheet UX on mobile**: Slide-over panels on small screens can feel cramped.
  → Mitigation: Acceptable given the portal's target audience (desktop-first finance workflow).

## Migration Plan

1. Add `PaymentAccount` model to `prisma/schema.prisma`
2. Run `prisma migrate dev` — additive migration, no existing columns dropped
3. Deploy new API routes and updated UI
4. Workers re-enter payment details through the new UI
5. (Follow-on) Data migration script to seed `PaymentAccount` rows from legacy Worker fields for any workers who have not re-entered
6. (Follow-on) Remove legacy payment columns from `Worker` after migration verified

Rollback: migration is additive — rolling back means reverting the UI code. The new table can be dropped without affecting existing Worker records.

## Open Questions

- Should the portal enforce that every worker has at least one preferred account before they can submit an invoice? (Currently no constraint — left as a UX improvement for later.)
- For Phase 3 Wise integration, will the `PaymentAccount` table be the source of truth for Wise recipient IDs, or will Wise recipient IDs be stored separately? (Out of scope here; Phase 3 design will decide.)
