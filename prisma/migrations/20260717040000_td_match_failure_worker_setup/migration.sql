-- CreateEnum
CREATE TYPE "TdFailureReason" AS ENUM ('UNMATCHED', 'NEEDS_SETUP', 'MISSING_RATE');

-- AlterTable
ALTER TABLE "TdMatchFailure" ADD COLUMN     "billingMonth" TEXT,
ADD COLUMN     "quantity" DOUBLE PRECISION,
ADD COLUMN     "reason" "TdFailureReason" NOT NULL DEFAULT 'UNMATCHED',
ADD COLUMN     "workerId" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "paymentConfigured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TdMatchFailure_workerId_idx" ON "TdMatchFailure"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_timeDoctorEmail_key" ON "Worker"("timeDoctorEmail");

-- AddForeignKey
ALTER TABLE "TdMatchFailure" ADD CONSTRAINT "TdMatchFailure_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill paymentConfigured for existing workers: best-effort signal that someone has
-- already deliberately touched this worker's payment setup (a CSV import or an admin edit),
-- distinct from a self-registered worker who's never been configured at all and is still
-- sitting on schema defaults. Workers matching neither condition surface as NEEDS_SETUP
-- failures on the next TD sync for admin review — see openspec/changes/td-sync-worker-onboarding.
UPDATE "Worker"
SET "paymentConfigured" = true
WHERE "hourlyRateUpdatedAt" IS NOT NULL OR "paymentType" != 'MANUAL';
