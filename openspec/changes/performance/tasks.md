## 1. Neon HTTP Driver

- [x] 1.1 Install new packages: `npm install @neondatabase/serverless @prisma/adapter-neon`
- [x] 1.2 Uninstall old packages: `npm uninstall pg @prisma/adapter-pg`
- [x] 1.3 Rewrite `lib/db.ts` — replace `pg.Pool` + `PrismaPg` with `neon()` + `PrismaNeon` (see `design.md` §1)
- [x] 1.4 Verify: `npm run build` compiles without errors; `npm run dev` connects to Neon successfully

## 2. Parallel DB Queries

- [x] 2.1 Update `app/(worker)/dashboard/page.tsx` — run `findUnique(user)` and `findUnique(worker)` in a single `Promise.all`; then run `findMany(invoices)` and `count(invoices)` in a second `Promise.all` (see `design.md` §2)
- [x] 2.2 Verify: dashboard loads with correct data; role redirect still works for ADMIN users

## 3. Smart Role Check

- [x] 3.1 Update `app/(worker)/dashboard/page.tsx` — only call `db.user.findUnique()` when `session.user.role !== \"ADMIN\"` (see `design.md` §3)
- [x] 3.2 Update `app/(admin)/layout.tsx` — same conditional pattern: skip DB check if JWT already says ADMIN
- [x] 3.3 Verify: existing ADMIN user (jack47.chn@gmail.com) navigates to /admin without DB role query; first-registered-user flow still promotes correctly after sign-up

## 4. Loading Skeletons

- [x] 4.1 Create `app/(worker)/dashboard/loading.tsx` — PageHeader skeleton + table skeleton (5 rows, `animate-pulse`)
- [x] 4.2 Create `app/(admin)/admin/loading.tsx` — PageHeader skeleton + 4 StatsCard skeletons + ActivityFeed skeleton (10 rows)
- [x] 4.3 Verify: navigate to /dashboard — skeleton appears immediately, then data fills in

## 5. Verification

- [x] 5.1 Measure before/after: open browser DevTools Network tab, hard-refresh /dashboard, compare TTFB and total load time
- [x] 5.2 Cold-start test: wait 5 minutes (let Neon go idle), then hard-refresh — confirm first load is <2s (vs previous 5–7s)
- [x] 5.3 `npm run build` — zero TypeScript errors
