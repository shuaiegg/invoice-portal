-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "claimToken" TEXT,
ADD COLUMN     "claimTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Worker_claimToken_key" ON "Worker"("claimToken");
