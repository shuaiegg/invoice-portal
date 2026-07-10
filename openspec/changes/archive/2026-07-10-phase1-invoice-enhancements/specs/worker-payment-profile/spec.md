## ADDED Requirements

### Requirement: Worker has a payment type classification
Each Worker record SHALL have a `paymentType` field with values: `td_only` (fully automated via Time Doctor), `td_plus` (TD hours pre-filled, worker adds adjustments), or `manual` (worker creates invoice from scratch). Default is `manual`. Admin can set this field.

#### Scenario: Admin sets worker to td_only
- **WHEN** an admin sets a worker's paymentType to `td_only`
- **THEN** the worker profile saves successfully and the field is reflected in the admin worker list

#### Scenario: New worker defaults to manual
- **WHEN** a new worker is registered without specifying paymentType
- **THEN** their paymentType defaults to `manual`

### Requirement: Worker has a Time Doctor email override
Each Worker record SHALL have an optional `timeDoctorEmail` field. When set, it is used for Time Doctor matching instead of the worker's login email. This supports workers whose TD account uses a different email.

#### Scenario: Worker with different TD email is matched
- **WHEN** a worker has `timeDoctorEmail = "john.td@example.com"` and login email `"john@example.com"`
- **THEN** Time Doctor sync uses `john.td@example.com` for matching

#### Scenario: Worker without timeDoctorEmail uses login email
- **WHEN** a worker has no `timeDoctorEmail` set
- **THEN** Time Doctor sync uses the worker's primary account email

### Requirement: Worker supports crypto payment details
A Worker record SHALL support storing cryptocurrency payment details: `cryptoCoin` (e.g. USDT), `cryptoNetwork` (e.g. TRC-20), and `cryptoWallet` (wallet address). All three fields are optional and stored as plain text.

#### Scenario: Worker saves crypto payment details
- **WHEN** a worker submits profile with `{cryptoCoin:"USDT", cryptoNetwork:"TRC-20", cryptoWallet:"T..."}`
- **THEN** all three fields are saved and returned in the profile response

#### Scenario: Worker with no crypto details
- **WHEN** a worker has no crypto fields set
- **THEN** all three fields are null and the profile is valid

### Requirement: Worker supports PayPal email
A Worker record SHALL support storing a `paypalEmail` field for workers paid via PayPal. The field is optional and validated as an email format when present.

#### Scenario: Worker saves PayPal email
- **WHEN** a worker submits `paypalEmail: "payments@worker.com"`
- **THEN** the email is saved and returned in profile

#### Scenario: Invalid PayPal email is rejected
- **WHEN** a worker submits `paypalEmail: "not-an-email"`
- **THEN** the API returns 422
