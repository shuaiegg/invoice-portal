## ADDED Requirements

### Requirement: Core domain models
The system SHALL define a Prisma schema with the following models: User, Worker, Invoice, Session, Account, InvoiceCounter, WebhookConfig. All models MUST use `cuid()` as the default ID strategy unless otherwise specified. All timestamps MUST be stored in UTC.

#### Scenario: Schema migration succeeds
- **WHEN** `prisma migrate deploy` is run against a fresh Neon database
- **THEN** all tables, indexes, and enum types are created without errors

#### Scenario: Prisma client generates correctly
- **WHEN** `prisma generate` is run after schema changes
- **THEN** the TypeScript client reflects all models with correct types

### Requirement: User and role model
The User model SHALL store authentication identity and role. Role SHALL be an enum with values `WORKER` and `ADMIN`. Users SHALL have an `active` boolean field (default `true`) that controls login access.

#### Scenario: User has correct defaults
- **WHEN** a User record is created without specifying role
- **THEN** `role` defaults to `WORKER` and `active` defaults to `true`

### Requirement: Worker profile model
The Worker model SHALL store contractor profile data linked one-to-one with a User. Worker fields SHALL include: name (required), team, address, city, country, vatNumber, vatRate (default 0), paymentMethod, paymentAccount, paymentNotes. A Worker record SHALL only be created after a WORKER-role user completes their profile.

#### Scenario: Worker links to exactly one User
- **WHEN** a Worker record is created
- **THEN** it references exactly one User via `userId` (unique constraint)

### Requirement: Invoice model
The Invoice model SHALL store all invoice data including computed amounts, status, and Xero sync state. Invoice status SHALL be an enum: `SUBMITTED`, `APPROVED`, `PAID`, `VOID`. The model SHALL have database indexes on `workerId`, `status`, and `invoiceDate` for query performance.

#### Scenario: Invoice defaults to SUBMITTED
- **WHEN** an Invoice record is created without specifying status
- **THEN** `status` defaults to `SUBMITTED`

#### Scenario: xeroSynced defaults to false
- **WHEN** an Invoice record is created
- **THEN** `xeroSynced` defaults to `false` and `xeroInvoiceId` is null

### Requirement: Race-condition-safe invoice number generation
The system SHALL use an InvoiceCounter table to generate sequential invoice numbers per year. The generation MUST be atomic using a PostgreSQL `INSERT ... ON CONFLICT DO UPDATE RETURNING count` statement. Invoice numbers SHALL follow the format `INV-{YYYY}-{NNNN}` (zero-padded to 4 digits).

#### Scenario: Concurrent submissions produce unique numbers
- **WHEN** two invoice submissions occur simultaneously for the same year
- **THEN** each receives a unique, sequential invoice number with no gaps or duplicates

#### Scenario: Counter resets per year
- **WHEN** the first invoice of a new year is submitted
- **THEN** the counter for that year starts at 1, independent of previous years

### Requirement: Neon PostgreSQL dual connection
The Prisma datasource SHALL use two connection strings: `DATABASE_URL` for pooled connections (pgbouncer) used at runtime, and `DIRECT_URL` for direct connections used by `prisma migrate`. This prevents connection pool exhaustion on Vercel serverless functions.

#### Scenario: Runtime queries use pooled connection
- **WHEN** the application handles a request in production
- **THEN** Prisma uses the pgbouncer-compatible `DATABASE_URL`

#### Scenario: Migrations use direct connection
- **WHEN** `prisma migrate deploy` is executed
- **THEN** Prisma uses `DIRECT_URL` to bypass pgbouncer
