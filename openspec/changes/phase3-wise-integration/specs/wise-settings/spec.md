## ADDED Requirements

### Requirement: Admin configures Wise API key and payment mode
The admin SHALL be able to enter a Wise API key via `/admin/settings/wise`, test the connection, and select payment mode (Mode A / Mode B). Settings are stored in `WiseConfig`.

#### Scenario: Admin saves valid API key
- **WHEN** an admin enters a valid Wise API key and clicks Save
- **THEN** the platform fetches the Wise profile ID, stores config, and shows "Connected — Profile: [name]"

#### Scenario: Invalid API key shows error
- **WHEN** an admin enters an invalid API key
- **THEN** the platform shows "Connection failed — check your API key"

### Requirement: Sandbox mode toggle
The admin SHALL be able to toggle between sandbox (`https://api.sandbox.transferwise.tech`) and production (`https://api.wise.com`) environments. The current environment SHALL be clearly displayed on the settings page and on the payments initiation UI.

#### Scenario: Sandbox mode active warning
- **WHEN** sandbox mode is enabled
- **THEN** a prominent yellow banner shows "SANDBOX MODE — transfers are simulated" on all payment-related pages
