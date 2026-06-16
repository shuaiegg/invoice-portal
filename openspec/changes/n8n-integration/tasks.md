## 1. Prerequisites & Credentials

- [ ] 1.1 Log into n8n instance and verify Xero OAuth2 credential type is available (post March 2026 granular scopes)
- [ ] 1.2 Create Xero OAuth2 credential in n8n: `Settings → Credentials → New → Xero OAuth2`; scopes: `openid profile email offline_access accounting.contacts accounting.invoices accounting.settings`
- [ ] 1.3 Complete Xero OAuth2 authorization flow to obtain initial tokens; verify n8n can list Xero tenants
- [ ] 1.4 Obtain Slack Incoming Webhook URL for #finance channel; store as environment variable or n8n credential
- [ ] 1.5 Note the n8n instance base URL and confirm MCP tools are accessible

## 2. invoice.submitted Workflow

- [ ] 2.1 Use n8n MCP tools (`n8n_create_workflow`) to create the `invoice.submitted` workflow skeleton with a Webhook trigger node
- [ ] 2.2 Add HTTP Request node: GET `/api/invoices/[invoiceId]` to fetch current invoice `updatedAt` (stale check)
- [ ] 2.3 Add IF node: compare payload `updatedAt` vs fetched `updatedAt` — if different, stop workflow (invoice was edited)
- [ ] 2.4 Add Xero node: Search Contacts by email (`EmailAddress` filter)
- [ ] 2.5 Add IF node: contact found → update path; not found → create path
- [ ] 2.6 Add Xero Create Contact node (not-found path): Name, EmailAddress, TaxNumber, STREET address
- [ ] 2.7 Add Xero Update Contact node (found path): update Name, TaxNumber, Address
- [ ] 2.8 Add Xero Create Invoice node: Type=ACCPAY, Status=DRAFT, Contact=upserted contact, Reference=`{period} | {paymentMethod}`, LineItems with description/qty/rate; add tax if vatRate > 0
- [ ] 2.9 Add Slack node: HTTP Request to Incoming Webhook URL with formatted message; set `onError: continueRegardless`
- [ ] 2.10 Add HTTP Request node: POST `/api/internal/sync-status` with `{ invoiceId, xeroInvoiceId }` and `X-Internal-Secret` header
- [ ] 2.11 Configure retry (2 retries, 30s wait) on Xero and sync-status nodes
- [ ] 2.12 Validate workflow with `n8n_validate_workflow` — fix any errors

## 3. invoice.updated Workflow

- [ ] 3.1 Create `invoice.updated` workflow with Webhook trigger node
- [ ] 3.2 Add IF node: `xeroInvoiceId` present in payload?
- [ ] 3.3 True path: Add Xero Update Invoice node with `xeroInvoiceId` — update line items and amounts
- [ ] 3.4 False path: reuse Xero create flow (same as invoice.submitted steps 2.4–2.8, minus Slack)
- [ ] 3.5 Add HTTP Request node: POST `/api/internal/sync-status` (same as submitted workflow)
- [ ] 3.6 Validate workflow with `n8n_validate_workflow` — fix any errors

## 4. WebhookConfig Setup

- [ ] 4.1 Log into admin portal at `/admin/settings`
- [ ] 4.2 Enter `invoice.submitted` webhook URL (from n8n), environment=production, enabled=true
- [ ] 4.3 Set a strong `internalSecret` (random 32-char string) — copy same value into n8n's sync-status HTTP Request node header
- [ ] 4.4 Enter `invoice.updated` webhook URL, environment=production, enabled=true
- [ ] 4.5 Set matching `internalSecret` for `invoice.updated` (can reuse same secret)
- [ ] 4.6 For local development: create separate `environment=development` records pointing to n8n test webhook URLs

## 5. End-to-End Verification

- [ ] 5.1 Submit a real test invoice from the worker portal
- [ ] 5.2 Check n8n execution history — confirm `invoice.submitted` workflow ran successfully
- [ ] 5.3 Log into Xero — confirm new draft bill (ACCPAY, DRAFT status) appears under the worker's contact
- [ ] 5.4 Check Slack #finance — confirm notification message received with correct fields
- [ ] 5.5 Check DB `Invoice` record — confirm `xeroSynced: true`, `xeroInvoiceId` populated, `xeroSyncedAt` set
- [ ] 5.6 Edit the test invoice — confirm `invoice.updated` workflow runs and updates Xero draft
- [ ] 5.7 Test stale check: submit → immediately edit → confirm only one Xero draft created (not two)
- [ ] 5.8 Test Xero failure handling: temporarily break Xero credential → submit invoice → confirm DB saved, `xeroSynced: false`, n8n shows retries
