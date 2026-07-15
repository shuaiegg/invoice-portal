/*
  Warnings:

  - A unique constraint covering the columns `[workerId,billingMonth]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "HourlyRateSource" AS ENUM ('TD_IMPORT', 'MANUAL');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billingMonth" TEXT,
ADD COLUMN     "tdSyncRunId" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "hourlyRateSource" "HourlyRateSource" NOT NULL DEFAULT 'TD_IMPORT',
ADD COLUMN     "hourlyRateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "hourlyRateUpdatedBy" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TimeDoctorConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "apiToken" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeDoctorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdSyncRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "invoicesCreated" INTEGER NOT NULL DEFAULT 0,
    "matchFailed" INTEGER NOT NULL DEFAULT 0,
    "inactiveSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "triggeredBy" TEXT,

    CONSTRAINT "TdSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdMatchFailure" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "tdUserId" TEXT NOT NULL,
    "tdEmail" TEXT NOT NULL,
    "tdName" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TdMatchFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerImportBatch" (
    "id" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkerImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRateConflict" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "portalRate" DOUBLE PRECISION NOT NULL,
    "importedRate" DOUBLE PRECISION NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRateConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TdSyncRun_runAt_idx" ON "TdSyncRun"("runAt");

-- CreateIndex
CREATE INDEX "TdMatchFailure_syncRunId_idx" ON "TdMatchFailure"("syncRunId");

-- CreateIndex
CREATE INDEX "TdMatchFailure_resolved_idx" ON "TdMatchFailure"("resolved");

-- CreateIndex
CREATE INDEX "WorkerImportBatch_importedAt_idx" ON "WorkerImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "WorkerRateConflict_workerId_idx" ON "WorkerRateConflict"("workerId");

-- CreateIndex
CREATE INDEX "WorkerRateConflict_importBatchId_idx" ON "WorkerRateConflict"("importBatchId");

-- CreateIndex
CREATE INDEX "WorkerRateConflict_resolved_idx" ON "WorkerRateConflict"("resolved");

-- CreateIndex
CREATE INDEX "Invoice_tdSyncRunId_idx" ON "Invoice"("tdSyncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workerId_billingMonth_key" ON "Invoice"("workerId", "billingMonth");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tdSyncRunId_fkey" FOREIGN KEY ("tdSyncRunId") REFERENCES "TdSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdMatchFailure" ADD CONSTRAINT "TdMatchFailure_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "TdSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRateConflict" ADD CONSTRAINT "WorkerRateConflict_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRateConflict" ADD CONSTRAINT "WorkerRateConflict_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "WorkerImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
