## ADDED Requirements

### Requirement: Admin gets a claim link when adding a worker
When an admin successfully creates a worker via the "Add worker" dialog, the system SHALL generate a one-time, expiring claim token for that worker and present a copyable claim link to the admin.

#### Scenario: Claim link shown on successful creation
- **WHEN** an admin creates a worker via "Add worker"
- **THEN** the response includes a `/claim/{token}` URL, and the UI shows it with a copy action instead of (or alongside) the existing success toast

#### Scenario: Claim links are not issued for other creation paths
- **WHEN** a worker is created via CSV import or by resolving a TD sync match failure
- **THEN** no claim token is generated; that worker continues to self-register via the existing email-match flow at `/register`

### Requirement: Worker sets their own password via the claim link
A worker SHALL be able to visit `/claim/{token}` and set their own password to create their account, without needing to separately know or type their Time Doctor email.

#### Scenario: Valid token
- **WHEN** a worker opens `/claim/{token}` for a token that is unexpired and whose `Worker.userId` is still null
- **THEN** they see a form pre-filled with their name (editable) and a password field; submitting creates their `User` account using the worker's `timeDoctorEmail` and links it to that `Worker`, exactly as the existing sign-up claim flow does

#### Scenario: Expired or already-used token
- **WHEN** a worker opens `/claim/{token}` for a token that is expired, unknown, or whose `Worker.userId` is already set
- **THEN** they see an error state directing them to contact their administrator; no account is created

#### Scenario: Claim link is not blocked by the registration-closed setting
- **WHEN** `registrationOpen` is `false` and a worker uses a valid, unexpired claim link
- **THEN** the claim succeeds — the link's own token validity is sufficient proof of legitimacy, independent of the general registration gate

### Requirement: Admin can regenerate a claim link
The admin SHALL be able to issue a new claim token for a still-unclaimed worker (e.g. the original link was lost or expired), invalidating the previous one.

#### Scenario: Regenerate replaces the old token
- **WHEN** an admin regenerates the claim link for a pending worker
- **THEN** a new token and expiry are set, and the previous token no longer resolves to a valid claim
