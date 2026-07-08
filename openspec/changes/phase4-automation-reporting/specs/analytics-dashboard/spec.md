## ADDED Requirements

### Requirement: Admin can view 12-month payment trends
The admin dashboard SHALL include an analytics section showing rolling 12-month charts for: total payment volume (€), worker headcount paid, and currency breakdown.

#### Scenario: Admin views analytics
- **WHEN** an admin visits `/admin/analytics`
- **THEN** they see bar/line charts for payment volume and headcount over the last 12 months

### Requirement: Analytics data updates after each monthly run
After the monthly automation run completes, the analytics data SHALL reflect the new month's figures without requiring a manual refresh.

#### Scenario: Data refreshes after run
- **WHEN** the monthly run completes for July 2026
- **THEN** the analytics dashboard shows July 2026 data
