## ADDED Requirements

### Requirement: Worker profile form
The profile page SHALL display a form with all Worker fields grouped into sections: Personal Info (name, team), Address (address, city, country), Tax (vatNumber, vatRate), Payment Details (paymentMethod, paymentAccount, paymentNotes). On first visit, the form is empty. On save, a Worker record is created or updated. Name is required; all other fields are optional but encouraged.

#### Scenario: First-time profile save creates Worker record
- **WHEN** a WORKER with no existing Worker record saves the profile form with a name
- **THEN** a Worker record is created linked to their User

#### Scenario: Subsequent saves update existing record
- **WHEN** a WORKER with an existing Worker record modifies and saves their profile
- **THEN** the Worker record is updated; no new record is created

#### Scenario: Save without name shows validation error
- **WHEN** a WORKER submits the profile form with an empty name field
- **THEN** a validation error appears and no API call is made

### Requirement: Profile completeness indicator
The system SHALL consider a Worker profile complete when the following fields are all non-empty: name, address, city, country, paymentMethod. The worker dashboard SHALL display a banner prompting profile completion when the profile is incomplete. The "New Invoice" button SHALL be disabled and show a tooltip when the profile is incomplete.

#### Scenario: Incomplete profile shows dashboard banner
- **WHEN** a WORKER with an incomplete profile views `/dashboard`
- **THEN** a banner appears: "Complete your profile before submitting invoices" with a link to `/profile`

#### Scenario: Complete profile hides banner and enables invoice button
- **WHEN** a WORKER with all required fields filled views `/dashboard`
- **THEN** no banner is shown and the "New Invoice" button is enabled
