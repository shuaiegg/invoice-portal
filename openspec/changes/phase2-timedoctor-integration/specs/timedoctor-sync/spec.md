## ADDED Requirements

### Requirement: Monthly cron triggers TD sync at UTC 06:00 on the 1st
The system SHALL run a scheduled job (`0 6 1 * *` UTC) that pulls the previous month's approved timesheet data from the Time Doctor API. The job SHALL be protected by `CRON_SECRET` header verification.

#### Scenario: Cron fires on the 1st
- **WHEN** Vercel Cron calls `GET /api/cron/td-sync` at 06:00 UTC on the 1st with valid `Authorization: Bearer {CRON_SECRET}`
- **THEN** the sync run starts and returns 200 within 30 seconds (async processing continues)

#### Scenario: Unauthorized cron call is rejected
- **WHEN** `GET /api/cron/td-sync` is called without a valid CRON_SECRET
- **THEN** the endpoint returns 401

### Requirement: TD users matched to Portal workers by email
The sync SHALL match each Time Doctor user to a Portal Worker by comparing TD user email against `Worker.timeDoctorEmail` (preferred) or `Worker.email`. Matching is case-insensitive.

#### Scenario: Worker matched by timeDoctorEmail
- **WHEN** TD returns user `{email:"john.td@co.com"}` and a Worker has `timeDoctorEmail="john.td@co.com"`
- **THEN** the worker is matched and an invoice is generated for them

#### Scenario: Worker matched by primary email as fallback
- **WHEN** TD returns user `{email:"jane@co.com"}` and a Worker has no `timeDoctorEmail` but `email="jane@co.com"`
- **THEN** the worker is matched

#### Scenario: Unmatched TD user goes to review queue
- **WHEN** TD returns a user with no matching Portal worker
- **THEN** the sync run records a `MATCH_FAILED` entry with the TD user's email and name

### Requirement: td_only workers get auto-submitted invoices
For matched workers with `paymentType = TD_ONLY`, the sync SHALL create an invoice with status `SUBMITTED` using TD hours × worker's hourly rate. No worker action is required.

#### Scenario: td_only invoice created
- **WHEN** a TD_ONLY worker worked 160 hours at €13/hr in the previous month
- **THEN** an invoice is created: one line item `{desc:"[Month] hours — Time Doctor", qty:160, rate:13}`, totalAmount=2080, status=SUBMITTED

#### Scenario: Duplicate prevention
- **WHEN** an invoice for this worker and month already exists (any status)
- **THEN** no new invoice is created; the existing one is left unchanged

### Requirement: td_plus workers get draft invoices for review
For matched workers with `paymentType = TD_PLUS`, the sync SHALL create an invoice with status `DRAFT` pre-filled with TD hours. The worker SHALL be notified via Slack/email to review and submit.

#### Scenario: td_plus draft invoice created
- **WHEN** a TD_PLUS worker worked 120 hours at €15/hr
- **THEN** an invoice is created with status=DRAFT, one pre-filled TD line item, and the worker receives a notification

#### Scenario: td_plus worker notification
- **WHEN** a DRAFT invoice is created for a td_plus worker
- **THEN** a Slack message or email is sent: "Your invoice for [Month] is ready. Please review and add any additional items, then submit."
