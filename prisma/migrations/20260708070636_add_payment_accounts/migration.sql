-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('BANK_TRANSFER', 'WISE', 'PAYPAL', 'CRYPTO', 'REVOLUT');

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "PaymentAccountType" NOT NULL,
    "label" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "swiftCode" TEXT,
    "email" TEXT,
    "cryptoCoin" TEXT,
    "cryptoNetwork" TEXT,
    "cryptoWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAccount_workerId_idx" ON "PaymentAccount"("workerId");

-- CreateIndex
CREATE INDEX "PaymentAccount_workerId_isPreferred_idx" ON "PaymentAccount"("workerId", "isPreferred");

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
