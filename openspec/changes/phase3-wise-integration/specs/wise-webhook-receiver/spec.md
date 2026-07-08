## ADDED Requirements

### Requirement: Portal receives and verifies Wise outgoing_payment_sent webhook
The portal SHALL expose `POST /api/webhooks/wise` to receive Wise transfer state-change events. Every incoming request SHALL be verified against the HMAC-SHA256 signature in the `X-Wise-Signature` header before processing.

#### Scenario: Valid webhook marks invoice PAID
- **WHEN** Wise posts `{event_type:"transfers#state-change", data:{status:"outgoing_payment_sent", customerTransactionId:"inv_xxx"}}` with valid signature
- **THEN** the invoice with matching ID is marked PAID, `PaymentRunItem.status` is updated, and a worker notification is sent

#### Scenario: Invalid signature is rejected
- **WHEN** a request arrives at `/api/webhooks/wise` with an invalid or missing signature
- **THEN** the endpoint returns 401 and no state changes are made

#### Scenario: Unknown transfer ID is ignored gracefully
- **WHEN** a webhook arrives with a `customerTransactionId` that matches no invoice
- **THEN** the endpoint returns 200 (to prevent Wise retries) and logs a warning

### Requirement: Wise webhook subscription is auto-registered on API key save
When an admin saves a Wise API key in settings, the platform SHALL automatically register a webhook subscription with Wise (`POST /v3/profiles/{profileId}/subscriptions`) pointing to `{APP_URL}/api/webhooks/wise`.

#### Scenario: Webhook registered on key save
- **WHEN** an admin saves a valid Wise API key and the subscription is not yet registered
- **THEN** the platform calls Wise subscriptions API and stores the subscription ID in `WiseConfig`

#### Scenario: Existing subscription not duplicated
- **WHEN** an admin saves an API key and a subscription already exists for this profile
- **THEN** no duplicate subscription is created
