## ADDED Requirements

### Requirement: Styled login form
The login page SHALL render a centered card with email input, password input, submit button, and a link to `/register`. The form SHALL show a loading state while the BetterAuth sign-in request is in flight. On error, a visible error message SHALL appear above the form without a full page reload.

#### Scenario: Successful login redirects correctly
- **WHEN** a WORKER submits valid credentials
- **THEN** the form shows a loading state, then redirects to `/dashboard`

#### Scenario: Failed login shows error inline
- **WHEN** a user submits wrong credentials
- **THEN** an error message appears in the form, the password field clears, and the page does not reload

### Requirement: Styled registration form
The register page SHALL render a centered card with name input, email input, password input, submit button, and a link to `/login`. On success, the user is redirected to `/dashboard` (WORKER) or `/admin` (ADMIN — first user).

#### Scenario: Registration with all fields succeeds
- **WHEN** a new user submits name, valid email, and password (min 8 chars)
- **THEN** the account is created and the user is redirected based on role

#### Scenario: Missing required field shows validation
- **WHEN** a user submits the form with an empty name field
- **THEN** a validation error appears on the name field before the API call is made
