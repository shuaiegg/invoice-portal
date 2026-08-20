/*
  Warnings:

  - You are about to drop the column `reviewedAt` on the `AnomalyFlag` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedBy` on the `AnomalyFlag` table. All the data in the column will be lost.
  - You are about to drop the column `pauseReason` on the `AutomationRun` table. All the data in the column will be lost.
  - You are about to drop the column `pausedAt` on the `AutomationRun` table. All the data in the column will be lost.
  - You are about to drop the column `resumedAt` on the `AutomationRun` table. All the data in the column will be lost.
  - You are about to drop the column `resumedBy` on the `AutomationRun` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnomalyFlag" DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedBy";

-- AlterTable
ALTER TABLE "AutomationRun" DROP COLUMN "pauseReason",
DROP COLUMN "pausedAt",
DROP COLUMN "resumedAt",
DROP COLUMN "resumedBy";
