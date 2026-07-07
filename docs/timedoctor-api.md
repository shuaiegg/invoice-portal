# Time Doctor API Reference

Source: https://timedoctor.redoc.ly/
Last verified: 2026-07-07

This document captures only the API facts relevant to Invoice Portal. It is not a full Time Doctor API reference.

## Integration Boundary

- Invoice Portal calls Time Doctor directly.
- n8n is not used for Time Doctor data sync.
- Time Doctor does not provide webhooks for this use case, so sync must be scheduled polling from Portal, for example Vercel Cron.
- Time Doctor data is a source for invoice generation, not the final payment authority. Portal still owns invoice state, review state, Xero sync, and payment records.

## Authentication

- Method: JWT bearer token.
- Header: `Authorization: JWT {token}`
- Token validity: approximately 6 months.
- Login endpoint: `POST /api/1.0/login`
- Login supports email/password and may require 2FA depending on the account.
- Company information can be read from authorization endpoints after login; store `companyId` in Portal settings once connected.

## Key Endpoints for Invoice Automation

### 1. User List

Use this to map Time Doctor users to Portal workers.

```http
GET /api/1.0/users
  ?company={companyId}
  &filter[email]={email}
```

Important matching rule:
- Time Doctor email filtering is not enough as the only source of truth.
- Treat `filter[email]` as a search helper, then perform a case-insensitive exact email match in Portal.
- Add `Worker.timeDoctorEmail` so Finance can override matching when a worker's Portal email and Time Doctor email differ.

Expected fields include:
- user id
- name
- email
- role/status fields, depending on response shape

### 2. Payroll Data

Use this to read configured hourly rate and payroll metadata.

```http
GET /api/1.0/users/payroll
  ?company={companyId}
```

Related write/config endpoints:

```http
PUT /api/1.0/users/{userId}/payroll
PUT /api/1.0/users/payroll/bulk
GET /api/1.0/companies/payroll
```

Portal should start read-only:
- Do not update Time Doctor payroll in Phase 2.
- Read payroll rate/currency as input data only.
- Let Finance review generated invoice totals before payment.

### 3. Worklog

Use this for detailed activity inspection and debugging.

```http
GET /api/1.0/activity/worklog
  ?company={companyId}
  &from=2026-05-01T00:00:00Z
  &to=2026-05-07T23:59:59Z
  &user={userId}
```

Notes:
- Worklog can be large. Keep request windows small, ideally around 7 days when pulling detailed worklog data.
- Durations are returned in seconds; convert to hours with `seconds / 3600`.
- Store raw source period and sync metadata for audit/debugging.

### 4. Aggregated Timesheet / Stats

Prefer aggregate endpoints for monthly invoice generation when possible.

```http
GET /api/1.1/stats/timesheet/total
  ?company={companyId}
  &from=2026-05-01T00:00:00Z
  &to=2026-05-31T23:59:59Z
  &user={userId}
```

Design preference:
- Use approved/timesheet totals for payroll-facing invoice generation.
- Use worklog only when Finance needs detail or discrepancy investigation.

## Pagination

- Common pattern: `?page=1&limit=100`
- Portal sync jobs must keep pagination explicit and resumable.

## Date And Time Rules

- Use ISO 8601 request timestamps.
- Treat Time Doctor source data as UTC.
- Convert display periods in Portal using the business reporting timezone selected for the company.
- Store the exact `from` and `to` boundaries used to generate each invoice.

## Portal Design Requirements

1. Time Doctor sync is Portal-owned and scheduled.
2. No n8n workflow may create, update, or approve invoices from Time Doctor data.
3. Worker matching must support `timeDoctorEmail` override and exact-match confirmation.
4. Generated invoice line items must preserve source metadata:
   - source: `timedoctor`
   - source user id
   - source period
   - hours
   - rate
   - currency
5. Developer/manual workflow invoices must remain adjustable after Time Doctor generation:
   - Time Doctor creates the base line item.
   - Worker/developer adds compensation or deduction line items.
   - Felipe/Finance reviews before approval.
6. Sync jobs must be idempotent by worker + period + source.
7. Unmatched users, missing rates, zero-hour records, and large variance from prior months must be surfaced in an Admin review queue.

## Open Questions Before Implementation

- Which Time Doctor company/account should Portal connect to?
- Which endpoint gives the cleanest approved monthly payroll number for the company setup?
- Are developer fixed monthly totals stored in Time Doctor payroll, Portal worker profile, or another source?
- What reporting timezone should be used for monthly boundaries?
