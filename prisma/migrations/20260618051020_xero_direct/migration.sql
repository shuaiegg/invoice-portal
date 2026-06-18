/*
  Warnings:

  - You are about to drop the `WebhookConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "WebhookConfig";

-- CreateTable
CREATE TABLE "XeroToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroToken_pkey" PRIMARY KEY ("id")
);
