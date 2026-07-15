-- AlterTable
ALTER TABLE "TdSyncRun" ADD COLUMN     "skippedExisting" INTEGER NOT NULL DEFAULT 0;

UPDATE "Invoice"
SET "billingMonth" = to_char("invoiceDate", 'YYYY-MM')
WHERE "billingMonth" IS NULL;
