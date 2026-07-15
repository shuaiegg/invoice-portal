# Payment Channel Grouping Spec

## ADDED Requirements

### Requirement: Invoice payout channel is derived live from the worker's preferred payment account
An invoice's payout channel SHALL be derived at read time from its worker's payment accounts: the preferred account's type maps WISE → `Wise`, PAYPAL → `PayPal`, and every other case (BANK_TRANSFER, CRYPTO, REVOLUT, OTHER, no preferred account, or no accounts at all) → `Manual`. If no account is marked preferred, the derivation SHALL fall back to the worker's single account if exactly one exists, otherwise `Manual`. The channel SHALL NOT be stored on the invoice.

#### Scenario: Wise worker
- **WHEN** a worker's preferred payment account has type WISE
- **THEN** all of that worker's invoices show channel Wise

#### Scenario: Crypto folds into Manual
- **WHEN** a worker's preferred payment account has type CRYPTO
- **THEN** the worker's invoices show channel Manual

#### Scenario: Channel follows account changes
- **WHEN** a worker switches their preferred account from PAYPAL to WISE mid-month
- **THEN** their unpaid invoices immediately appear under the Wise channel

### Requirement: Admin invoice list groups by channel
The admin invoice list SHALL provide channel tabs (`All`, `Wise`, `PayPal`, `Manual`) with per-tab invoice counts scoped to the active month/status filters, a channel value visible on each row, and a `channel` URL filter parameter. The channel filter SHALL combine with existing month, status, and worker-name filters.

#### Scenario: Channel tab filters the list
- **WHEN** admin is on June 2026 with 120 Wise / 45 PayPal / 38 Manual invoices and selects the Wise tab
- **THEN** the list shows only the 120 Wise invoices and the URL contains `channel=wise`

#### Scenario: Tab counts respect other filters
- **WHEN** the status filter is APPROVED and 80 of the 120 June Wise invoices are APPROVED
- **THEN** the Wise tab count shows 80

### Requirement: CSV export supports the channel filter
The admin CSV export SHALL accept the channel filter and include a payout-channel column, so each channel's batch can be exported for external payment execution.

#### Scenario: Export a Wise payment batch
- **WHEN** admin exports CSV with `month=2026-06&channel=wise&status=APPROVED`
- **THEN** the file contains only June APPROVED invoices whose derived channel is Wise, each row showing channel and the worker's payout account detail
