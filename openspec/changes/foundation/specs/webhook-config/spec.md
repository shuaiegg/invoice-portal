## ADDED Requirements

### Requirement: WebhookConfig data model
The system SHALL store webhook configuration in a `WebhookConfig` table keyed by event name (e.g., `invoice.submitted`, `invoice.updated`). Each record SHALL store: `url` (the n8n webhook URL), `enabled` (boolean), `environment` (`production` or `development`), `secret` (optional, sent as `X-Webhook-Secret` header to n8n), `internalSecret` (optional, expected on n8n's callback to Next.js), and `lastTriggeredAt` (timestamp of last successful dispatch).

#### Scenario: WebhookConfig record can be created per event
- **WHEN** an admin saves a webhook for `invoice.submitted`
- **THEN** a WebhookConfig record is created with key `invoice.submitted`

#### Scenario: Two environments can be configured independently
- **WHEN** a webhook is saved with `environment: "development"`
- **THEN** it is stored separately and independently from a `production` record with the same key

### Requirement: Webhook URL is masked in API responses
The system SHALL never return the full webhook URL in any API response. URLs SHALL be masked showing only the last 6 characters: e.g., `https://n8n.example.com/webhook/****a3b2c1`. The full URL SHALL only be readable server-side.

#### Scenario: GET webhook config returns masked URL
- **WHEN** an admin fetches webhook configuration via the admin settings API
- **THEN** the response contains a masked URL, not the full value

### Requirement: Admin settings UI for webhook management
The system SHALL provide an admin settings page at `/admin/settings` where ADMIN users can view, create, update, and toggle webhook configurations. The UI SHALL display the masked URL, enabled status, environment, and last triggered timestamp for each configured webhook.

#### Scenario: Admin can update webhook URL
- **WHEN** an admin submits a new URL for an existing webhook key
- **THEN** the WebhookConfig record is updated and the masked new URL is shown

#### Scenario: Admin can toggle webhook enabled state
- **WHEN** an admin toggles the enabled switch for a webhook
- **THEN** `enabled` is updated in the database immediately

### Requirement: Webhook dispatch respects enabled flag and environment
The system SHALL only dispatch a webhook if: (1) a WebhookConfig record exists for the event key, (2) `enabled` is `true`, and (3) `environment` matches the current runtime environment (`NODE_ENV`). The full URL MUST be read server-side at dispatch time and never exposed to the client.

#### Scenario: Disabled webhook is not called
- **WHEN** an invoice is submitted and the `invoice.submitted` webhook has `enabled: false`
- **THEN** no HTTP request is made to the webhook URL

#### Scenario: Wrong environment webhook is not called
- **WHEN** running in production and the only configured webhook has `environment: "development"`
- **THEN** no HTTP request is made

### Requirement: Webhook secret header
If a WebhookConfig record has a non-null `secret`, the system SHALL include it as `X-Webhook-Secret: <secret>` in the outgoing webhook HTTP request to n8n.

#### Scenario: Secret is sent as header
- **WHEN** a webhook is dispatched for a config that has a non-null `secret`
- **THEN** the HTTP request to n8n includes `X-Webhook-Secret: <secret value>`
