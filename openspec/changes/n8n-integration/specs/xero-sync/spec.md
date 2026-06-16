## ADDED Requirements

### Requirement: Xero contact upsert on invoice submission
The `invoice.submitted` n8n workflow SHALL search Xero contacts by the worker's email address. If a contact exists, it SHALL be updated with current name, address, and VAT number. If no contact exists, a new Xero contact SHALL be created. Contact fields: Name, EmailAddress, TaxNumber (VAT number), Addresses (STREET type with AddressLine1, City, Country).

#### Scenario: New worker creates Xero contact
- **WHEN** an invoice is submitted for a worker whose email does not exist in Xero
- **THEN** a new Xero contact is created with the worker's profile data

#### Scenario: Existing worker updates Xero contact
- **WHEN** an invoice is submitted for a worker whose email already exists in Xero
- **THEN** the existing Xero contact is updated — no duplicate contact is created

### Requirement: Xero draft bill creation
After contact upsert, the workflow SHALL create a Xero bill with: Type `ACCPAY`, Status `DRAFT`, Contact (the upserted contact), InvoiceDate, DueDate (same as InvoiceDate), Reference (`{period} | {paymentMethod}`), LineItems containing description, quantity, unit price, and account code. If vatRate > 0, a tax type SHALL be applied to the line item.

#### Scenario: Draft bill appears in Xero after submission
- **WHEN** the workflow completes successfully
- **THEN** a DRAFT bill is visible in Xero under the worker's contact

#### Scenario: Xero draft is never auto-approved
- **WHEN** the workflow creates a bill
- **THEN** the bill status is always DRAFT — never AUTHORISED or PAID

### Requirement: n8n handles OAuth2 token refresh transparently
The Xero OAuth2 credential in n8n SHALL handle access token refresh automatically. No token management code SHALL exist in Next.js.

#### Scenario: Token refresh is transparent
- **WHEN** the Xero access token has expired
- **THEN** n8n refreshes it automatically before making API calls, with no intervention required

### Requirement: invoice.updated workflow updates existing draft
The `invoice.updated` n8n workflow SHALL check if `xeroInvoiceId` is present in the payload. If present, it SHALL update the existing Xero draft bill with new field values. If absent (sync not yet completed), it SHALL create a new draft bill as in the submitted flow.

#### Scenario: Existing draft is updated, not duplicated
- **WHEN** a worker edits a synced invoice and the updated webhook fires
- **THEN** the existing Xero draft bill is updated — no second bill is created
