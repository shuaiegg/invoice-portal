-- CreateIndex
CREATE INDEX "Invoice_billingMonth_idx" ON "Invoice"("billingMonth");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_billingMonth_status_idx" ON "Invoice"("billingMonth", "status");
