## Why

Page response feels slow due to three compounding issues: Neon serverless cold starts over TCP (3–7s on first request after idle), sequential database queries on every page load, and a redundant DB role check on every request for users whose JWT already has the correct role. Together these add 300–700ms of avoidable latency per page navigation under normal conditions, and several seconds on cold start.

## What Changes

- **Neon HTTP driver**: Replace `pg` + `@prisma/adapter-pg` with `@neondatabase/serverless` + `@prisma/adapter-neon`. Neon's serverless driver uses HTTP instead of TCP — no connection handshake, no cold-start penalty.
- **Parallel DB queries**: Dashboard page runs 4 DB queries sequentially; the first two (user role + worker profile) are independent and can run in parallel with `Promise.all`.
- **Smart role check**: Skip the DB role lookup when the JWT already says `ADMIN` — the DB check is only needed when JWT says `WORKER` (to catch the first-user-admin case where JWT was minted before the hook fired).
- **Add `loading.tsx` skeletons**: Next.js App Router streaming — page shell renders instantly, data fills in. Covers dashboard and admin overview.

## Capabilities

### Modified Capabilities

- `db-connection`: Switches from TCP pg pool to Neon HTTP adapter. No API or schema changes. Behaviour identical; latency significantly lower, especially on cold start.
- `worker-profile` / `invoice-history`: Dashboard data fetching parallelized — wall-clock time drops from ~4 sequential DB round-trips to ~2 parallel round-trips.
- `admin-dashboard`: Same parallel fetch pattern (already partly parallelized; role check optimized).
- `auth-role-check`: DB role lookup now conditional — skipped when JWT role is already `ADMIN`, performed only when JWT role is `WORKER` (to detect first-user promotion).

## Impact

- **Package changes**: Remove `pg`, `@prisma/adapter-pg`; add `@neondatabase/serverless`, `@prisma/adapter-neon`
- **Modified files**: `lib/db.ts`, `app/(worker)/dashboard/page.tsx`, `app/(admin)/layout.tsx`, `app/(admin)/admin/page.tsx`
- **New files**: `app/(worker)/dashboard/loading.tsx`, `app/(admin)/admin/loading.tsx`
- **No schema or API changes** — purely internal optimisation
- **No behaviour changes** — same data, same auth, same redirects
