-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "internalSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookConfig_key_environment_key" ON "WebhookConfig"("key", "environment");
