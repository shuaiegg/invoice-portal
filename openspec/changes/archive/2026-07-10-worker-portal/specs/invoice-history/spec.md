## ADDED Requirements

### Requirement: Worker dashboard invoice list
The dashboard (`/dashboard`) SHALL display all invoices for the authenticated worker, sorted newest-first. Columns SHALL include: Invoice Number, Period, Total Amount (EUR formatted), Status (StatusBadge), Invoice Date. Clicking any row navigates to `/invoice/[id]`. An empty state is shown when no invoices exist.

#### Scenario: Invoice list shows correct columns
- **WHEN** a worker with submitted invoices views `/dashboard`
- **THEN** each invoice row shows invoice number, period, total amount, status badge, and date

#### Scenario: Empty state shown for new workers
- **WHEN** a worker with no invoices views `/dashboard`
- **THEN** an EmptyState component displays with a "Submit your first invoice" CTA

#### Scenario: Worker sees only their own invoices
- **WHEN** a worker views `/dashboard`
- **THEN** only invoices belonging to their Worker record are returned — no other workers' invoices

### Requirement: Invoice list pagination
The dashboard invoice list SHALL show a maximum of 20 invoices per page with pagination controls when more exist.

#### Scenario: More than 20 invoices shows pagination
- **WHEN** a worker has 25 invoices
- **THEN** page 1 shows 20 invoices and pagination controls appear for page 2
