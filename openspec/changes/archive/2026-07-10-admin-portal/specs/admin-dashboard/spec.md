## ADDED Requirements

### Requirement: Admin stats overview
The admin dashboard (`/admin`) SHALL display four stats cards computed for the current calendar month: total invoices submitted, count of invoices pending approval (status SUBMITTED), total amount paid (sum of totalAmount where status PAID), count of active workers. All stats SHALL be computed server-side on page load.

#### Scenario: Stats reflect current month data
- **WHEN** an admin views `/admin` in June 2026
- **THEN** all stats are scoped to June 2026 invoices (except active workers which is a total)

### Requirement: Recent activity feed
The admin dashboard SHALL display the 10 most recently submitted invoices as an activity feed, showing: worker name, invoice number, period, total amount, submission timestamp.

#### Scenario: Activity feed shows latest submissions
- **WHEN** an admin views `/admin`
- **THEN** the feed lists up to 10 invoices sorted by `createdAt` descending
