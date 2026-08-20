-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'RUN_PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('HOUR_DEVIATION', 'AMOUNT_CEILING', 'MISSING_TD_DATA');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('HIGH', 'MEDIUM');

-- CreateTable
CREATE TABLE "AutomationConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hourDeviationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "amountCeiling" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "resumedAt" TIMESTAMP(3),
    "resumedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyFlag" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "workerId" TEXT,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "details" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "currencyBreakdown" JSONB NOT NULL,
    "xeroStatus" TEXT,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRun_billingMonth_idx" ON "AutomationRun"("billingMonth");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AnomalyFlag_runId_idx" ON "AnomalyFlag"("runId");

-- CreateIndex
CREATE INDEX "AnomalyFlag_invoiceId_idx" ON "AnomalyFlag"("invoiceId");

-- CreateIndex
CREATE INDEX "AnomalyFlag_workerId_idx" ON "AnomalyFlag"("workerId");

-- CreateIndex
CREATE INDEX "MonthlyReport_year_month_idx" ON "MonthlyReport"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_year_month_key" ON "MonthlyReport"("year", "month");

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
