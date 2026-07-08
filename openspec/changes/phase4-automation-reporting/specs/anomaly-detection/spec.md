## ADDED Requirements

### Requirement: Flag invoices with significant hour deviation
Before initiating payment, the system SHALL compare each worker's hours to their prior 3-month average. If deviation exceeds a configurable threshold (default 20%), an `AnomalyFlag` SHALL be created.

#### Scenario: Worker hours spike detected
- **WHEN** a worker's monthly hours are 200 but their 3-month average was 80
- **THEN** an AnomalyFlag is created: type=HOUR_DEVIATION, severity=HIGH

### Requirement: Flag invoices exceeding amount ceiling
Invoices with `totalAmount` above a configurable ceiling (default €10,000) SHALL be flagged for human review before payment.

#### Scenario: High-value invoice flagged
- **WHEN** an invoice total is €12,500 and the ceiling is €10,000
- **THEN** an AnomalyFlag is created: type=AMOUNT_CEILING, severity=HIGH

### Requirement: Flag TD match failures
Workers in the active payroll who have no matching TD record for the current month SHALL be flagged (they may have left, changed email, or have an issue).

#### Scenario: Active worker not in TD data
- **WHEN** a TD_ONLY worker has no TD hours for the month
- **THEN** an AnomalyFlag is created: type=MISSING_TD_DATA, severity=MEDIUM
