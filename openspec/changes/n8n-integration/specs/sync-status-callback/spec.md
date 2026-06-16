## ADDED Requirements

### Requirement: n8n calls back to update sync status
As the final step of both workflows (`invoice.submitted` and `invoice.updated`), n8n SHALL POST to Next.js `/api/internal/sync-status` with the invoice ID and Xero invoice ID. This updates the Invoice record's `xeroSynced`, `xeroInvoiceId`, and `xeroSyncedAt` fields.

#### Scenario: Successful callback updates Invoice record
- **WHEN** n8n posts `{ invoiceId, xeroInvoiceId }` to sync-status with the correct internal secret
- **THEN** the Invoice record shows `xeroSynced: true`, `xeroInvoiceId` populated, `xeroSyncedAt` set to current timestamp

#### Scenario: Callback uses correct internal secret
- **WHEN** n8n makes the callback request
- **THEN** it includes the `X-Internal-Secret` header matching the value configured in WebhookConfig for `invoice.submitted`

### Requirement: n8n retries on transient failures
The n8n workflows SHALL be configured with retry logic (at least 2 retries with backoff) for the Xero API steps and the sync-status callback. Permanent failures SHALL be visible in the n8n execution history for manual review.

#### Scenario: Transient Xero failure triggers retry
- **WHEN** the Xero API returns a 5xx error
- **THEN** n8n retries the step up to 2 times before marking the execution as failed
