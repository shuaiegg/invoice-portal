## ADDED Requirements

### Requirement: Flag invoices with significant hour deviation
Before the run completes, the system SHALL compare each worker's hours to their prior 3-month average. If deviation exceeds a configurable threshold (default 20%), an `AnomalyFlag` SHALL be created with severity HIGH.

**Edge case — new workers (<3 months history):** Workers with fewer than 3 prior months of invoice data SHALL be skipped for hour deviation checks. Only the amount ceiling check applies to them.

#### Scenario: Worker hours spike detected
- **WHEN** a worker's monthly hours are 200 but their 3-month average was 80
- **THEN** an AnomalyFlag is created: type=HOUR_DEVIATION, severity=HIGH

#### Scenario: New worker skipped for hour deviation
- **WHEN** a worker has fewer than 3 months of invoice history
- **THEN** no HOUR_DEVIATION flag is created; amount ceiling check still applies

### Requirement: Flag invoices exceeding amount ceiling
Invoices with `totalAmount` above a configurable ceiling (default €10,000) SHALL be flagged for human review. Applies to all workers including new ones.

#### Scenario: High-value invoice flagged
- **WHEN** an invoice total is €12,500 and the ceiling is €10,000
- **THEN** an AnomalyFlag is created: type=AMOUNT_CEILING, severity=HIGH

### Requirement: Flag TD match failures
TD_ONLY workers in the active payroll who have no matching TD record for the current month SHALL be flagged. Severity is MEDIUM — does not block the run, but is visible in the anomaly list for admin awareness.

#### Scenario: Active worker not in TD data
- **WHEN** a TD_ONLY worker has no TD hours for the month
- **THEN** an AnomalyFlag is created: type=MISSING_TD_DATA, severity=MEDIUM

### Severity rules
- **HIGH**: blocks run — run enters `RUN_PAUSED` until all HIGH flags are reviewed
- **MEDIUM**: informational only — does not block run completion
