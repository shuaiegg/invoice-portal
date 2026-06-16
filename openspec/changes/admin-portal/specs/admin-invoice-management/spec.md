## ADDED Requirements

### Requirement: Admin invoice list with filters
The admin invoices page (`/admin/invoices`) SHALL display all invoices across all workers with filter controls: status (multi-select), period (text), worker name (search), team (select). The list SHALL be sortable by invoice date, total amount, and status. Default sort is newest-first.

#### Scenario: Filter by status narrows results
- **WHEN** an admin selects status filter "SUBMITTED"
- **THEN** only SUBMITTED invoices are shown

#### Scenario: Worker name search is case-insensitive partial match
- **WHEN** an admin types "mar" in the worker name search
- **THEN** invoices from workers whose names contain "mar" (e.g. "Maria", "Marco") are shown

### Requirement: Individual invoice status transition
On the admin invoice detail page (`/admin/invoices/[id]`), an admin SHALL be able to change the invoice status using a dropdown. Valid transitions are: SUBMITTED → APPROVED, APPROVED → PAID, any status → VOID. Reverse transitions (e.g. PAID → SUBMITTED) are not permitted.

#### Scenario: Admin approves a submitted invoice
- **WHEN** an admin changes status from SUBMITTED to APPROVED
- **THEN** the Invoice record is updated and the status badge reflects the new status

#### Scenario: Invalid status transition is rejected
- **WHEN** an API call attempts to set a PAID invoice back to SUBMITTED
- **THEN** the API returns 400 and the DB record is not changed

### Requirement: Xero sync status visibility
Each invoice in the list and detail view SHALL display the Xero sync status: "Synced" (xeroSynced: true), "Pending" (xeroSynced: false, invoice recent), "Failed" (xeroSynced: false, invoice older than 30 minutes).

#### Scenario: Sync failure is visible to admin
- **WHEN** an invoice was submitted more than 30 minutes ago and xeroSynced is still false
- **THEN** the invoice shows a "Sync Failed" indicator in both list and detail views

### Requirement: Bulk mark as paid
The admin invoices list SHALL support selecting multiple APPROVED invoices via checkboxes and bulk-updating their status to PAID via a "Mark as Paid" button.

#### Scenario: Bulk mark as paid updates all selected
- **WHEN** an admin selects 5 APPROVED invoices and clicks "Mark as Paid"
- **THEN** all 5 Invoice records are updated to PAID status in a single operation
