# Product Requirements Document
# Worker Invoice Portal

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-06-16

---

## 1. Overview

### 1.1 Background

The company works with 200+ remote contractors (workers) across multiple countries. Currently, workers submit invoices manually via Slack or email in inconsistent formats. This creates significant manual work for the bookkeeping team (Nataly) and the payment team (Lorena), and produces invoices that may not meet accounting and tax compliance standards.

### 1.2 Product Summary

The **Worker Invoice Portal** is a web application that enables workers to register, manage their profile, and submit invoices through a standardized form. The system automatically generates a fully compliant PDF invoice and syncs the data to the company's Xero accounting instance. An admin dashboard allows the finance and management team to track, manage, and update invoice statuses.

### 1.3 Goals

- Standardize invoice submission across all workers and countries
- Generate legally compliant invoice PDFs meeting accountant-specified requirements
- Automatically sync invoice data to Xero as draft bills for bookkeeping
- Give workers a self-service portal to manage their invoices and download copies
- Give finance/admin a central dashboard to track payment status
- Eliminate manual data entry for Nataly and ad-hoc Slack invoice collection for Lorena

---

## 2. Stakeholders

| Role | Name | Responsibility |
|------|------|---------------|
| Bookkeeper | Nataly | Reviews draft bills in Xero, approves invoices |
| Payment Team | Lorena | Processes payments, updates payment status |
| Workers | 200+ contractors | Submit invoices monthly |
| Management | Aurelien / Anis | Project sponsor, oversight |
| Developer | Jack | Build and maintain the system |

---

## 3. User Roles

### 3.1 Worker
- Registers with email and password
- Manages personal profile (address, VAT, payment info)
- Submits monthly invoices
- Downloads PDF copies of submitted invoices
- Views invoice history and payment status

### 3.2 Admin
- Views all workers and their invoice history
- Updates invoice status (Submitted → Approved → Paid)
- Manages worker accounts (activate/deactivate)
- Exports invoice data
- Monitors Xero sync status

---

## 4. Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Authentication | BetterAuth |
| ORM | Prisma |
| Database | Neon (PostgreSQL) |
| PDF Generation | @react-pdf/renderer |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |
| Accounting | Xero API (OAuth2) |
| Notifications | Slack API (Incoming Webhook) |

---

## 5. Design System

### 5.1 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#00A0FF` | Buttons, links, highlights |
| Text | `#19191B` | Body text, headings |
| Secondary Text | `#7B7E85` | Labels, placeholders, secondary info |
| Accent | `#F2F2F3` | Backgrounds, cards, dividers |
| White | `#FFFFFF` | Page background, input fields |
| Success | `#22C55E` | Paid status, success states |
| Warning | `#F59E0B` | Pending status |
| Error | `#EF4444` | Error states, failed sync |

### 5.2 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headings | Inter | 700 | 24–32px |
| Body | Inter | 400 | 14–16px |
| Labels | Inter | 500 | 12–14px |
| Buttons | Inter | 600 | 14px |

### 5.3 Component Library

Use **shadcn/ui** as the base component library, customized with the brand colors above. Key components: Button, Input, Select, Table, Badge, Card, Dialog, Tabs.

---

## 6. Data Models

### 6.1 Prisma Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      Role     @default(WORKER)
  createdAt DateTime @default(now())

  worker    Worker?
  sessions  Session[]
}

enum Role {
  WORKER
  ADMIN
}

model Worker {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])

  // Personal Info
  name           String
  team           String?

  // Address
  address        String?
  city           String?
  country        String?

  // Tax
  vatNumber      String?
  vatRate        Float?   @default(0)

  // Payment
  paymentMethod  String?
  paymentAccount String?
  paymentNotes   String?

  invoices       Invoice[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique  // INV-2026-0001
  worker        Worker        @relation(fields: [workerId], references: [id])
  workerId      String

  // Invoice Details
  description   String
  period        String        // e.g. "June 2026"
  serviceDate   DateTime?
  invoiceDate   DateTime
  quantity      Float
  rate          Float
  netAmount     Float         // quantity × rate
  vatAmount     Float         @default(0)
  totalAmount   Float         // netAmount + vatAmount

  // Status
  status        InvoiceStatus @default(SUBMITTED)

  // Xero
  xeroInvoiceId String?
  xeroSynced    Boolean       @default(false)
  xeroSyncedAt  DateTime?

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

enum InvoiceStatus {
  SUBMITTED
  APPROVED
  PAID
  REJECTED
}
```

### 6.2 Invoice Number Generation

Format: `INV-{YYYY}-{NNNN}` (e.g. `INV-2026-0001`)

Sequential, auto-incremented per year. Generated server-side at submission time.

---

## 7. Pages & Routes

### 7.1 Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing / Login | Login form, link to register |
| `/register` | Registration | Email + password + name |
| `/forgot-password` | Password Reset | Email reset flow |

### 7.2 Worker Routes (authenticated, role: WORKER)

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | My Invoices | List of all submitted invoices with status |
| `/profile` | My Profile | Edit personal info, address, VAT, payment details |
| `/invoice/new` | New Invoice | Submit a new invoice (profile pre-filled) |
| `/invoice/[id]` | Invoice Detail | View invoice details + download PDF |

### 7.3 Admin Routes (authenticated, role: ADMIN)

| Route | Page | Description |
|-------|------|-------------|
| `/admin` | Dashboard | Overview stats, recent activity |
| `/admin/workers` | Workers List | All registered workers |
| `/admin/workers/[id]` | Worker Detail | Profile + invoice history |
| `/admin/invoices` | All Invoices | Full invoice list with filters |
| `/admin/invoices/[id]` | Invoice Detail | Invoice info + status management |

---

## 8. Feature Specifications

### 8.1 Worker Registration & Login

- Email + password registration
- BetterAuth handles session management
- On first login, worker is prompted to complete their profile before submitting invoices
- Profile completion indicator shown on dashboard

### 8.2 Worker Profile

Fields saved to the `Worker` table:

**Personal Info**
- Full Name (required)
- Team (required)

**Address** (required for compliant invoices)
- Street Address
- City
- Country

**Tax**
- VAT Number (optional)
- VAT Rate % (optional, default 0)

**Payment Details**
- Payment Method (e.g. Bank Transfer, Alipay, PayPal)
- Payment Account (IBAN / account number / email)
- Payment Notes (optional)

Profile data is pre-filled on every new invoice form. Workers can update their profile at any time; changes apply to future invoices only.

### 8.3 New Invoice Submission

Form fields pre-filled from profile (editable):
- Name, Address, VAT Number, VAT Rate, Payment info

Fields worker fills each month:
- Service Description (textarea)
- Period (e.g. "June 2026")
- Service Date (if different from invoice date)
- Quantity (hours or units)
- Rate (per hour or unit)
- Invoice Date (defaults to today)

**On Submit:**
1. Validate all required fields
2. Generate sequential invoice number
3. Calculate: Net Amount = Quantity × Rate, VAT Amount, Total
4. Write to database (Prisma → Neon)
5. Create/update Xero Contact
6. Create Xero Draft Bill (ACCPAY)
7. Generate PDF invoice (@react-pdf/renderer)
8. Send Slack notification to #finance
9. Return PDF to browser for immediate download
10. Redirect to `/invoice/[id]` with success state

### 8.4 PDF Invoice Generation

Generated by `@react-pdf/renderer` on the server (Next.js API Route). Contains all fields required by accountants:

```
INVOICE #INV-2026-0001
─────────────────────────────────────────────
From:                        To:
[Worker Name]                [Company Name]
[Address]                    [Company Address]
[City, Country]              [Country]
VAT: [VATNumber]

Invoice Date: [Date]
Service Period: [Period]
─────────────────────────────────────────────
Description          Qty     Rate    Amount
[Description]        [Qty]   [Rate]  [Net]
─────────────────────────────────────────────
                              Net:   [Net]
                     VAT ([Rate]%):  [VAT]
                            Total:   [Total]
─────────────────────────────────────────────
Payment Method: [Method]
Account: [Account]
[Notes]
```

PDF is generated fresh on demand (not stored). Invoice ID stored in DB allows re-generation at any time.

### 8.5 Invoice History (Worker)

- List of all submitted invoices, newest first
- Columns: Invoice #, Period, Amount, Status, Date
- Status badges: Submitted (grey), Approved (blue), Paid (green), Rejected (red)
- Click any row → Invoice Detail page
- Download PDF button on each row

### 8.6 Admin Dashboard

**Stats cards:**
- Total invoices this month
- Pending approval count
- Paid this month (total amount)
- Active workers count

**Recent activity feed:**
- Latest invoice submissions

### 8.7 Admin Invoice Management

- Full invoice list with filters: Team, Status, Period, Worker name
- Sort by date, amount, status
- Bulk status update: select multiple → Mark as Paid
- Export to CSV
- Per-invoice: view details, change status, view Xero sync status

### 8.8 Admin Worker Management

- List all workers with: Name, Team, Email, Invoice count, Last submission
- Toggle active/inactive
- View worker profile + full invoice history
- Search by name, email, team

---

## 9. API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/[...betterauth]` | BetterAuth handler |
| GET/PUT | `/api/profile` | Get/update worker profile |
| GET | `/api/invoices` | List worker's invoices |
| POST | `/api/invoices` | Submit new invoice |
| GET | `/api/invoices/[id]` | Get invoice detail |
| GET | `/api/invoices/[id]/pdf` | Generate and return PDF |
| GET | `/api/admin/invoices` | List all invoices (admin) |
| PUT | `/api/admin/invoices/[id]` | Update invoice status (admin) |
| GET | `/api/admin/workers` | List all workers (admin) |
| PUT | `/api/admin/workers/[id]` | Update worker status (admin) |

---

## 10. Xero Integration

### 10.1 Authentication

- OAuth2 with scopes: `openid profile email offline_access accounting.contacts accounting.invoices accounting.settings`
- Tokens stored securely in environment variables (single company account)
- Generic OAuth2 credential (Xero's new granular scopes, post March 2026)

### 10.2 Contact Sync

On each invoice submission:
1. Search Xero Contacts by worker email
2. If found → update (name, address, VAT number)
3. If not found → create new contact

Contact fields:
```json
{
  "Name": "Worker Name",
  "EmailAddress": "worker@email.com",
  "TaxNumber": "VAT Number",
  "Addresses": [{
    "AddressType": "STREET",
    "AddressLine1": "Address",
    "City": "City",
    "Country": "Country"
  }]
}
```

### 10.3 Draft Bill Creation

- Type: `ACCPAY`
- Status: `DRAFT` (never auto-approved or paid)
- Reference: `{Period} | {PaymentMethod}`
- Line items include VAT line if VATRate > 0

### 10.4 Error Handling

- Xero API failures do NOT block invoice submission
- Invoice is always saved to DB first
- Xero sync failure is logged; `xeroSynced: false` in DB
- Admin dashboard shows sync failures for manual retry

---

## 11. Slack Integration

On each successful invoice submission, send a notification to `#finance`:

```
💼 [Worker Name] has submitted an invoice.
Team: [Team]
Period: [Period]
Amount: [Total] (Net: [Net] + VAT: [VAT])
Payment: [PaymentMethod] ([PaymentAccount])
Invoice #: [InvoiceNumber]
→ Review draft bill in Xero
```

- Uses Slack Incoming Webhook (no OAuth required)
- Webhook URL stored in environment variable

---

## 12. Non-Functional Requirements

### 12.1 Security
- All routes protected by BetterAuth session middleware
- Workers can only access their own data (enforced server-side)
- Admin routes require `role: ADMIN` check
- VAT numbers and payment details treated as sensitive data
- HTTPS enforced (Vercel default)

### 12.2 Performance
- PDF generation < 3 seconds
- Xero API calls handled asynchronously where possible
- Database queries optimized with Prisma indexes on `workerId`, `status`, `invoiceDate`

### 12.3 Reliability
- Invoice always saved to DB before external API calls
- Xero/Slack failures are non-blocking and logged
- Neon auto-pause prevention: scheduled ping every 5 days (Vercel Cron)

### 12.4 Accessibility
- WCAG 2.1 AA compliance
- Form validation with clear error messages
- Mobile-responsive layout

---

## 13. Environment Variables

```env
# Database
DATABASE_URL=

# BetterAuth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# Xero OAuth2
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_TENANT_ID=

# Slack
SLACK_WEBHOOK_URL=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 14. Out of Scope (v1.0)

- Multi-company Xero support
- Worker-to-worker messaging
- Automatic payment processing
- Time tracking integration (Time Doctor)
- Mobile native app
- Invoice approval workflow (Nataly approves in Xero directly)
- Multi-currency support (handled by Xero)
- Custom invoice branding per company

---

## 15. Future Considerations

- **Security enhancements**: Token-based form links, submission time windows, duplicate detection
- **Time Doctor integration**: Auto-populate hours from time tracking
- **Payment confirmation flow**: Lorena marks paid in portal instead of Xero
- **Worker VAT filing reminders**: Alert workers approaching VAT threshold
- **Batch export**: Generate all invoices for a period as a ZIP
- **Multi-language support**: Worker interface in local languages

---

## 16. Milestones

| Phase | Scope | Priority |
|-------|-------|---------|
| Phase 1 | Auth + Profile + Invoice Form + PDF generation | Must have |
| Phase 2 | Xero sync + Slack notification + Invoice history | Must have |
| Phase 3 | Admin dashboard + Status management | Should have |
| Phase 4 | Export + Bulk actions + Xero sync monitoring | Nice to have |
