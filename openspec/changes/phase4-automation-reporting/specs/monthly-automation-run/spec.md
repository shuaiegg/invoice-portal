## ADDED Requirements

### Requirement: Monthly cron chains TD sync through Wise payment automatically
The monthly cron run SHALL chain: TD sync → invoice generation → anomaly check → (if no blocking anomalies) Wise batch payment initiation. If anomalies are detected, the run SHALL pause and notify #finance for human review before proceeding.

#### Scenario: Clean run with no anomalies
- **WHEN** cron fires on the 1st and all workers match and no anomalies are detected
- **THEN** invoices are generated, Wise batch is initiated automatically, and a Slack summary is posted

#### Scenario: Run pauses on anomaly
- **WHEN** cron fires and 3 workers show >20% hour deviation from prior month
- **THEN** invoices are generated but Wise batch is NOT initiated; Slack alert sent to #finance with anomaly details

### Requirement: Admin can resume paused automation run
After reviewing anomalies, an admin SHALL be able to mark each anomaly as reviewed and resume the run, which then proceeds to Wise batch payment.

#### Scenario: Admin clears anomalies and resumes
- **WHEN** an admin reviews and dismisses all anomaly flags for a run
- **THEN** the Wise batch payment initiates and the run completes
