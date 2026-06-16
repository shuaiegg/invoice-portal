## ADDED Requirements

### Requirement: Route group separation
The application SHALL organize routes into three Next.js App Router route groups: `(auth)` for public authentication pages, `(worker)` for authenticated worker pages, and `(admin)` for authenticated admin pages. Each group SHALL have its own layout component. Route groups MUST NOT appear in the URL path.

#### Scenario: Auth routes are publicly accessible
- **WHEN** an unauthenticated user visits `/login` or `/register`
- **THEN** the page renders without session validation

#### Scenario: Worker routes require authentication
- **WHEN** an unauthenticated user visits `/dashboard` or `/profile`
- **THEN** they are redirected to `/login`

#### Scenario: Admin routes require authentication and ADMIN role
- **WHEN** a WORKER-role user visits `/admin`
- **THEN** they receive a 403 or are redirected to `/dashboard`

### Requirement: Edge-compatible middleware
The system SHALL implement a `middleware.ts` at the project root that runs on the Edge Runtime. The middleware SHALL validate the BetterAuth JWT session cookie for all routes except: `(auth)` pages (`/login`, `/register`, `/forgot-password`), `/api/auth/*`, and static assets. The middleware SHALL NOT perform database queries.

#### Scenario: Middleware protects all worker and admin routes
- **WHEN** any request arrives for a route outside the public allowlist
- **THEN** the middleware checks for a valid JWT session before allowing the request

#### Scenario: Middleware does not check role
- **WHEN** an authenticated WORKER-role user requests an admin route
- **THEN** middleware allows the request (role enforcement is the admin layout's responsibility)

### Requirement: Admin role enforcement at layout level
The `(admin)` layout SHALL verify that the current session user has `role: ADMIN`. If the user is authenticated but not ADMIN, they SHALL be redirected to `/dashboard`.

#### Scenario: Admin layout blocks worker
- **WHEN** a WORKER navigates to `/admin`
- **THEN** the admin layout redirects to `/dashboard`

### Requirement: Page route shells
All routes defined in the PRD SHALL exist as page files (may be empty shells) after this change: `/login`, `/register`, `/forgot-password`, `/dashboard`, `/profile`, `/invoice/new`, `/invoice/[id]`, `/admin`, `/admin/workers`, `/admin/workers/[id]`, `/admin/invoices`, `/admin/invoices/[id]`, `/admin/settings`.

#### Scenario: All routes return 200
- **WHEN** an authenticated user with the correct role visits any defined route
- **THEN** the page renders without a 404 or routing error

### Requirement: BetterAuth API route
The system SHALL expose a catch-all API route at `/api/auth/[...betterauth]/route.ts` that handles all BetterAuth authentication endpoints (sign-in, sign-up, sign-out, session).

#### Scenario: Auth endpoints respond correctly
- **WHEN** the client calls `/api/auth/sign-in` with valid credentials
- **THEN** BetterAuth processes the request and returns a session response

### Requirement: Internal sync-status endpoint
The system SHALL expose a `POST /api/internal/sync-status` route handler that n8n calls after completing Xero synchronization. The endpoint SHALL validate the `X-Internal-Secret` header against the matching WebhookConfig's `internalSecret` field. On success, it SHALL update the Invoice's `xeroSynced`, `xeroInvoiceId`, and `xeroSyncedAt` fields.

#### Scenario: Valid secret updates invoice
- **WHEN** n8n posts to `/api/internal/sync-status` with correct `X-Internal-Secret` and `{ invoiceId, xeroInvoiceId }`
- **THEN** the invoice record is updated with `xeroSynced: true`, `xeroInvoiceId`, and `xeroSyncedAt: now()`

#### Scenario: Invalid secret rejected
- **WHEN** a request arrives at `/api/internal/sync-status` with a missing or incorrect secret
- **THEN** the endpoint returns 401 and makes no database changes
