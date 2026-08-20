## ADDED Requirements

### Requirement: Invoice status changes by admin are recorded
When an admin changes an invoice status (single or bulk), the system SHALL write an `AuditLog` entry per invoice.

#### Scenario: Admin approves an invoice
- **WHEN** an admin changes invoice status to APPROVED
- **THEN** an AuditLog entry is created: action=INVOICE_STATUS_CHANGED, details include invoiceNumber, workerName, from, to

#### Scenario: Admin bulk-marks invoices as PAID
- **WHEN** an admin bulk-marks 10 invoices as PAID
- **THEN** 10 AuditLog entries are created, each with `bulk: true` in details

### Requirement: Admin can view audit log
The admin SHALL be able to view a read-only chronological log at `/admin/audit` showing: timestamp, actor name, action, and details. Newest entries appear first.

#### Scenario: Admin views audit log
- **WHEN** an admin visits `/admin/audit`
- **THEN** they see a paginated table of all audit events with human-readable descriptions
