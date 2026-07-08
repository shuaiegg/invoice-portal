## ADDED Requirements

### Requirement: Monthly finance report auto-generated on the 2nd
On the 2nd of each month at 08:00 UTC, the system SHALL generate a finance report for the prior month and post it to #finance on Slack. The report SHALL include: total payments by currency, total by team, worker count, and Xero reconciliation status.

#### Scenario: Report posted to Slack
- **WHEN** the report cron fires on the 2nd
- **THEN** a Slack message is posted to #finance with a summary table and a link to the full report in the admin portal

### Requirement: Admin can download monthly report as CSV
The admin SHALL be able to download a CSV of each month's payment data: worker name, invoice number, amount, currency, payment method, payment date, and Xero bill ID.

#### Scenario: Admin downloads CSV
- **WHEN** an admin clicks "Export CSV" on the monthly report page
- **THEN** a CSV file downloads with one row per paid invoice
