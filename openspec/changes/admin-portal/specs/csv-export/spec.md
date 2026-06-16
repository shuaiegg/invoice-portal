## ADDED Requirements

### Requirement: CSV export of invoices
The admin invoices page SHALL provide an "Export CSV" button that downloads all invoices matching the current filters as a CSV file. The CSV SHALL include columns: Invoice Number, Worker Name, Team, Period, Description, Quantity, Rate, Net Amount, VAT Amount, Total Amount, Status, Invoice Date, Xero Synced. The file SHALL be UTF-8 encoded with BOM for Excel compatibility. Amounts SHALL be plain numbers (no currency symbols) for spreadsheet use.

#### Scenario: Export with active filters produces filtered CSV
- **WHEN** an admin has filtered invoices to status "PAID" and clicks "Export CSV"
- **THEN** the downloaded CSV contains only PAID invoices matching the current filter state

#### Scenario: Export with no filters produces all invoices
- **WHEN** an admin clicks "Export CSV" with no active filters
- **THEN** the CSV contains all invoices in the system

#### Scenario: CSV is Excel-compatible
- **WHEN** the CSV file is opened in Microsoft Excel
- **THEN** international characters (accented names, etc.) display correctly due to UTF-8 BOM
- **THEN** amount columns are recognized as numbers, not text
