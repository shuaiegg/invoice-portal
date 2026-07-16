# Payment Channel Grouping Spec

## ADDED Requirements

### Requirement: Invoice payout channel is derived live, with TD payroll as the authority
An invoice's payout channel SHALL be derived at read time from its worker. The TD-payroll-imported `Worker.paymentMethod` is the source of truth: `Wise` → `Wise`, `PayPal` → `PayPal`, any other non-empty value (Manual, Bank transfer, …) → `Manual`. Only when the worker has no TD payment method SHALL the derivation fall back to the worker's payment accounts (preferred account's type; single account if none preferred; WISE → Wise, PAYPAL → PayPal, all else → Manual). The channel SHALL NOT be stored on the invoice.

#### Scenario: TD payroll overrides the worker's own preferred account
- **WHEN** a worker's TD payment method is `Manual` but their preferred portal account is WISE
- **THEN** the worker's invoices show channel Manual

#### Scenario: Wise per TD payroll
- **WHEN** a worker's TD payment method is `Wise`
- **THEN** all of that worker's invoices show channel Wise

#### Scenario: Account fallback when TD has no value
- **WHEN** a worker has no TD payment method and their preferred payment account has type PAYPAL
- **THEN** the worker's invoices show channel PayPal

#### Scenario: Crypto folds into Manual
- **WHEN** a worker has no TD payment method and their preferred payment account has type CRYPTO
- **THEN** the worker's invoices show channel Manual

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
