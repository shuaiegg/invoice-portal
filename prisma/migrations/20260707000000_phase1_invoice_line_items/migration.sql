-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('TD_ONLY', 'TD_PLUS', 'MANUAL');

-- AlterTable
ALTER TABLE "Worker"
ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "timeDoctorEmail" TEXT,
ADD COLUMN "cryptoCoin" TEXT,
ADD COLUMN "cryptoNetwork" TEXT,
ADD COLUMN "cryptoWallet" TEXT,
ADD COLUMN "paypalEmail" TEXT;

-- AlterTable
ALTER TABLE "Invoice"
ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceLine"
ADD CONSTRAINT "InvoiceLine_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
