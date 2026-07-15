-- CreateTable
CREATE TABLE "TdIgnoredEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "ignoredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdIgnoredEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TdIgnoredEmail_email_key" ON "TdIgnoredEmail"("email");
