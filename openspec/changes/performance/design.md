## 1. Neon HTTP Driver

### Why HTTP over TCP

Current `lib/db.ts` uses `pg.Pool` which requires a TCP connection to Neon. On a serverless/edge environment (Vercel), each function instance starts cold and must establish a new TCP connection — this handshake alone can take 3–7s when Neon's compute is also cold.

Neon's own `@neondatabase/serverless` driver sends queries over HTTP (or WebSocket for transactions). HTTP requires no persistent connection, so latency is dominated by the query itself (~50–100ms) rather than connection setup.

### Change to `lib/db.ts`

```ts
// Before
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// After
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

const sql = neon(process.env.DATABASE_URL!);
const adapter = new PrismaNeon(sql);
```

`DATABASE_URL` (pooler URL) remains unchanged. `DIRECT_URL` for migrations also unchanged.

> **Transactions**: `PrismaNeon` uses the HTTP driver by default, which supports transactions via Neon's HTTP transaction API. No code changes needed in callers.

---

## 2. Parallel DB Queries — Dashboard

### Current (sequential, ~325ms total)

```
getSession()          [5ms]
  → findUnique(user)  [80ms]   ← wait
    → findUnique(worker) [80ms] ← wait
      → findMany(invoices) [80ms] ← wait
      → count(invoices)    [80ms] ← wait
```

### After (parallel, ~170ms total)

```
getSession()                    [5ms]
  → Promise.all([
      findUnique(user),          [80ms] ─┐ parallel
      findUnique(worker),        [80ms] ─┘
    ])
    → if ADMIN → redirect
    → Promise.all([              [80ms] ─┐ parallel
        findMany(invoices),              │
        count(invoices),                 │
      ])                                ─┘
```

Wall-clock drops from ~325ms to ~170ms (with warm connections; cold start improvement is larger).

### Code pattern

```ts
const [dbUser, worker] = await Promise.all([
  db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
  db.worker.findUnique({ where: { userId: session.user.id } }),
]);

if (dbUser?.role === "ADMIN") redirect("/admin");

const [invoices, totalInvoices] = worker
  ? await Promise.all([
      db.invoice.findMany({ where: { workerId: worker.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.invoice.count({ where: { workerId: worker.id } }),
    ])
  : [[], 0];
```

---

## 3. Smart Role Check

### The problem

Every page load calls `db.user.findUnique()` to read the DB role. This exists because on first registration, the JWT is minted before the `after:create` hook promotes the first user to ADMIN — so JWT says `WORKER` but DB says `ADMIN`.

Once a user logs out and back in, the JWT correctly reflects their DB role. So the DB check is only necessary when `session.user.role === "WORKER"`.

### Logic

```ts
// session.user.role comes from JWT
let isAdmin = (session.user as any).role === "ADMIN";

if (!isAdmin) {
  // JWT says WORKER — could be stale (first-user case). Check DB.
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  isAdmin = dbUser?.role === "ADMIN";
}

if (isAdmin) redirect("/admin");
```

**Effect**: All established ADMIN users skip the extra DB query entirely. Only `WORKER`-JWT users incur the check (which is the safe fallback).

This applies to: `dashboard/page.tsx` and `(admin)/layout.tsx`.

---

## 4. Streaming with `loading.tsx`

Next.js App Router automatically wraps each `page.tsx` in a Suspense boundary when a sibling `loading.tsx` exists. The shell (nav, layout) renders immediately; the page content streams in when ready.

### Files to add

**`app/(worker)/dashboard/loading.tsx`** — skeleton matching the dashboard layout:
- PageHeader skeleton (two lines)
- Invoice table skeleton (5 placeholder rows with pulsing grey bars)

**`app/(admin)/admin/loading.tsx`** — skeleton matching the admin overview:
- PageHeader skeleton
- 4 StatsCard skeletons in a grid
- ActivityFeed skeleton (10 rows)

Use Tailwind `animate-pulse` on `bg-muted rounded` divs. No new dependencies.

### UX impact

Navigation to dashboard or admin now feels instant — the layout appears in <50ms, data fills within 200ms. Eliminates the "blank page" during server render.
