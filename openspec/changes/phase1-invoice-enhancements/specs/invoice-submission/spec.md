## MODIFIED Requirements

### Requirement: Invoice submission requires line items
Invoice submission SHALL accept a `lines` array instead of a flat `amount`/`description`. The API SHALL compute `totalAmount` server-side. A submission without lines or with an empty array SHALL be rejected with 422.

#### Scenario: Successful submission with lines
- **WHEN** a worker posts `{invoiceDate, lines:[{description:"Hours", quantity:160, unitRate:13}]}`
- **THEN** the invoice is created with totalAmount=2080 and status SUBMITTED

#### Scenario: Submission without lines is rejected
- **WHEN** a worker posts `{invoiceDate}` with no `lines` field
- **THEN** the API returns 422 "Invoice must have at least one line item"

### Requirement: Invoice edit updates line items
The invoice edit endpoint (while in SUBMITTED status) SHALL accept a `lines` array and replace all existing line items atomically. Partial line updates are not supported.

#### Scenario: Worker replaces all lines
- **WHEN** a worker PUTs `{lines:[{description:"Hours", quantity:168, unitRate:13}, {description:"Bonus", quantity:1, unitRate:500}]}`
- **THEN** all prior lines are deleted and replaced, totalAmount recalculated to 2684
