## ADDED Requirements

### Requirement: Monthly cron chains TD sync through anomaly gate automatically
The monthly cron run SHALL chain: TD sync → invoice generation → anomaly check → (if no blocking anomalies) run marked COMPLETED. If HIGH severity anomalies are detected, the run SHALL pause and record `RUN_PAUSED` status for human review. No automatic payment initiation — finance pays manually after the run completes or after anomalies are cleared.

#### Scenario: Clean run with no anomalies
- **WHEN** cron fires on the 1st and all workers match and no HIGH anomalies are detected
- **THEN** invoices are generated, `AutomationRun` status is set to `COMPLETED`, and admin can see the result on `/admin/automation`

#### Scenario: Run pauses on anomaly
- **WHEN** cron fires and HIGH severity anomalies are detected (e.g. >20% hour deviation)
- **THEN** invoices are generated but run status is set to `RUN_PAUSED`; admin sees the paused run and anomaly list on `/admin/automation`

### Requirement: Admin can resume a paused automation run
After reviewing anomalies, a single admin SHALL be able to mark each HIGH anomaly as reviewed and resume the run. No second-admin confirmation required. No timeout — a paused run waits indefinitely for human clearance.

#### Scenario: Admin clears anomalies and resumes
- **WHEN** an admin marks all HIGH anomaly flags as reviewed and clicks "Resume Run"
- **THEN** `AutomationRun` status is set to `COMPLETED`; the run is considered done and finance can proceed with manual payment of all APPROVED invoices for the month

#### Scenario: Run stays paused indefinitely
- **WHEN** a run is in `RUN_PAUSED` state and no admin has acted
- **THEN** the run remains in `RUN_PAUSED` with no automatic timeout or failure; it must be resolved manually
