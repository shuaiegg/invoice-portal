## ADDED Requirements

### Requirement: Admin can view sync run results
The admin dashboard SHALL display the results of the most recent TD sync run, including: run timestamp, invoices generated (count + total amount), match failures (count + list), and run status (success / partial / failed).

#### Scenario: Sync completed with failures
- **WHEN** an admin views the TD sync panel after a run that matched 148/152 workers
- **THEN** they see "148 invoices generated · €56,200 · 4 unmatched" with a list of the 4 unmatched TD users

#### Scenario: No sync has run yet
- **WHEN** an admin views the panel before any sync has run
- **THEN** they see "No sync runs yet"

### Requirement: Admin can manually trigger a sync run
The admin SHALL be able to manually trigger a TD sync run from the dashboard (outside of the scheduled cron). This is used for testing and for re-running after fixing match failures.

#### Scenario: Admin triggers manual sync
- **WHEN** an admin clicks "Run Sync Now" in the TD sync panel
- **THEN** a sync run starts and the UI shows a loading state, then updates with results

### Requirement: Admin can resolve match failures
For each unmatched TD user in the review queue, the admin SHALL be able to manually link them to a Portal worker or dismiss the entry.

#### Scenario: Admin links unmatched user
- **WHEN** an admin selects a Portal worker from a dropdown for an unmatched TD user and saves
- **THEN** `Worker.timeDoctorEmail` is set to the TD user's email and the entry is removed from the queue
