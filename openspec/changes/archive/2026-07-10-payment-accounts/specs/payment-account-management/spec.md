## ADDED Requirements

### Requirement: Worker can add a payment account
The system SHALL allow an authenticated worker to create a payment account by selecting a type and filling in the corresponding fields. Supported types are: `BANK_TRANSFER`, `WISE`, `PAYPAL`, `CRYPTO`, `REVOLUT`.

Each type requires the following fields:

| Type | Required fields | Optional fields |
|------|----------------|-----------------|
| BANK_TRANSFER | accountNumber | bankName, swiftCode, label |
| WISE | email | label |
| PAYPAL | email | label |
| CRYPTO | cryptoCoin, cryptoNetwork, cryptoWallet | label |
| REVOLUT | email | label |

All accounts MAY include a `label` (user-defined name, e.g. "Main Bank", "USDT Wallet").

#### Scenario: Worker adds a bank transfer account
- **WHEN** worker selects type "Bank Transfer" and submits a valid account number
- **THEN** a new PaymentAccount record is created with type BANK_TRANSFER and the worker's id

#### Scenario: Worker adds a crypto account
- **WHEN** worker selects type "Crypto" and submits coin, network, and wallet address
- **THEN** a new PaymentAccount record is created with type CRYPTO

#### Scenario: Worker submits without required fields
- **WHEN** worker submits an account with missing required fields for the selected type
- **THEN** the system returns a 422 error naming the missing field(s)

---

### Requirement: Worker can edit a payment account
The system SHALL allow a worker to update any field of their own payment account, including changing the label or type-specific details.

#### Scenario: Worker edits account label
- **WHEN** worker updates the label of an existing account
- **THEN** the PaymentAccount record reflects the new label

#### Scenario: Worker cannot edit another worker's account
- **WHEN** a worker submits a PUT request for an account that belongs to a different worker
- **THEN** the system returns 403 Forbidden

---

### Requirement: Worker can delete a payment account
The system SHALL allow a worker to delete any of their payment accounts. If the deleted account was preferred, the system SHALL clear the preferred flag (no account will be preferred after deletion).

#### Scenario: Worker deletes a non-preferred account
- **WHEN** worker deletes an account that is not preferred
- **THEN** the account is removed; other accounts are unaffected

#### Scenario: Worker deletes the preferred account
- **WHEN** worker deletes the account marked as preferred
- **THEN** the account is removed and no other account becomes preferred automatically

---

### Requirement: Exactly one preferred account per worker
The system SHALL enforce that at most one PaymentAccount per worker has `isPreferred = true`. When a worker sets an account as preferred, all other accounts for that worker MUST have `isPreferred` set to false atomically.

#### Scenario: Worker sets a new preferred account
- **WHEN** worker marks account B as preferred (account A was previously preferred)
- **THEN** account B has isPreferred = true and account A has isPreferred = false, in a single transaction

#### Scenario: Worker marks their only account as preferred
- **WHEN** worker marks their sole account as preferred
- **THEN** that account has isPreferred = true

#### Scenario: Worker unsets preferred without setting another
- **WHEN** worker removes the preferred flag from their only preferred account
- **THEN** no account for that worker is preferred (isPreferred = false for all)

---

### Requirement: Admin can view all payment accounts for a worker
The system SHALL include a worker's payment accounts (ordered: preferred first, then by createdAt) in the admin worker detail API response. No admin-side create/edit/delete is needed in this phase.

#### Scenario: Admin fetches worker with payment accounts
- **WHEN** admin calls GET /api/admin/workers/:id
- **THEN** response includes a `paymentAccounts` array with all accounts for that worker, preferred account first

#### Scenario: Worker has no payment accounts
- **WHEN** admin fetches a worker who has not added any payment accounts
- **THEN** `paymentAccounts` is an empty array
