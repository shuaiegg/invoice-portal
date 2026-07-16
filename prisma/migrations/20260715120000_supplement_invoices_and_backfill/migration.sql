-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "supplementNo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TdSyncRun" ADD COLUMN     "billingMonth" TEXT;

-- Backfill TdSyncRun.billingMonth from the invoices each run created
UPDATE "TdSyncRun" r
SET "billingMonth" = sub.bm
FROM (
  SELECT "tdSyncRunId", MIN("billingMonth") AS bm
  FROM "Invoice"
  WHERE "tdSyncRunId" IS NOT NULL AND "billingMonth" IS NOT NULL
  GROUP BY "tdSyncRunId"
) sub
WHERE sub."tdSyncRunId" = r.id;

-- DropIndex — must happen BEFORE the billingMonth backfill: legacy rows can hold
-- several same-month invoices per worker, which the old two-column key forbids.
DROP INDEX "Invoice_workerId_billingMonth_key";

-- Backfill Invoice.billingMonth for legacy worker-submitted rows
UPDATE "Invoice"
SET "billingMonth" = to_char("invoiceDate", 'YYYY-MM')
WHERE "billingMonth" IS NULL;

-- Assign supplement numbers within duplicate (workerId, billingMonth) groups.
-- TD-generated invoices rank first (they are the month's primary), then by creation time.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "workerId", "billingMonth"
           ORDER BY ("tdSyncRunId" IS NULL), "createdAt", id
         ) - 1 AS rn
  FROM "Invoice"
  WHERE "billingMonth" IS NOT NULL
)
UPDATE "Invoice" i
SET "supplementNo" = ranked.rn
FROM ranked
WHERE i.id = ranked.id AND ranked.rn > 0;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workerId_billingMonth_supplementNo_key" ON "Invoice"("workerId", "billingMonth", "supplementNo");
