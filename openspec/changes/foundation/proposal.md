## Why

The Worker Invoice Portal has a scaffolded Next.js 16 app with no authentication, database, or route structure. Before any feature can be built, the foundational layers must be in place: a secure auth system, a validated database schema, a well-organized route hierarchy, and a webhook configuration model that supports the n8n integration architecture chosen during design exploration.

## What Changes

- Install and configure BetterAuth with JWT session strategy (Edge Runtime compatible)
- Define the complete Prisma schema for all domain models: User, Worker, Invoice, InvoiceCounter, WebhookConfig, Session, Account
- Create Next.js App Router route groups: `(auth)`, `(worker)`, `(admin)` with shared layouts and a root middleware
- Implement middleware that validates JWT sessions and protects all non-auth routes
- Create `lib/auth.ts`, `lib/db.ts`, and `lib/invoice-number.ts` as shared server utilities
- Set up Neon PostgreSQL with dual connection strings (pooled runtime + direct for migrations)
- Scaffold all page routes as empty shells (content filled in subsequent changes)
- Add `/api/internal/sync-status` route handler (secured endpoint for n8n callbacks)

## Capabilities

### New Capabilities

- `authentication`: User registration and login via BetterAuth (JWT session). First registered user automatically receives ADMIN role. Admin can deactivate user accounts. Middleware protects all non-public routes.
- `database-schema`: Full Prisma schema covering all domain models with correct relations, indexes, and enums. Includes InvoiceCounter for race-condition-safe sequential invoice numbering and WebhookConfig for n8n integration management.
- `route-architecture`: Next.js App Router route group structure separating auth, worker, and admin surfaces. Each group has its own layout. Admin role enforcement at layout level.
- `webhook-config`: WebhookConfig data model supporting multiple named webhook events (e.g., `invoice.submitted`, `invoice.updated`) with per-environment URL, enabled toggle, masking, and internal callback secret.

### Modified Capabilities

## Impact

- **New dependencies**: `better-auth`, `prisma`, `@prisma/client`
- **New environment variables**: `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- **Files created**: `prisma/schema.prisma`, `middleware.ts`, `lib/auth.ts`, `lib/db.ts`, `lib/invoice-number.ts`, all route group layouts, all page shells, `app/api/auth/[...betterauth]/route.ts`, `app/api/internal/sync-status/route.ts`
- **No Xero credentials required**: Xero integration is fully delegated to n8n
