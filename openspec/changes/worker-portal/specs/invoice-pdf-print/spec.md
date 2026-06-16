## ADDED Requirements

### Requirement: Print-ready invoice detail page
The invoice detail page (`/invoice/[id]`) SHALL render all invoice fields in a structured layout that matches the PRD invoice template. The page SHALL include a "Download PDF" button that calls `window.print()`. A `@media print` CSS block SHALL hide all navigation, buttons, and page chrome so only the invoice content prints.

#### Scenario: Print button triggers browser print dialog
- **WHEN** a worker clicks "Download PDF" on the invoice detail page
- **THEN** the browser print dialog opens with a preview showing only the invoice content

#### Scenario: Print preview contains all required fields
- **WHEN** the invoice prints
- **THEN** the output contains: invoice number, invoice date, worker name and address, company name and address, VAT number, service period, description, quantity, rate, net amount, VAT amount, total amount, payment method and account

### Requirement: Invoice date and amounts formatted for print
All dates on the invoice detail page SHALL be formatted as DD/MM/YYYY in the Europe/Paris timezone. Amounts SHALL be formatted as EUR currency (e.g. "€1,250.00"). VAT section SHALL only appear if vatRate > 0.

#### Scenario: Zero VAT rate hides VAT line
- **WHEN** an invoice has vatRate of 0
- **THEN** the VAT line does not appear in the printed invoice

#### Scenario: Dates display in Paris timezone
- **WHEN** an invoice stored with UTC timestamp is rendered
- **THEN** the invoice date displays in DD/MM/YYYY format adjusted to Europe/Paris timezone
