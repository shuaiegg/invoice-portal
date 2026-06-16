## ADDED Requirements

### Requirement: User registration
The system SHALL allow any visitor to create an account with a valid email address and password. Upon successful registration, the user SHALL be assigned the WORKER role by default. If no other users exist in the database at the time of registration, the new user SHALL be assigned the ADMIN role instead.

#### Scenario: Successful worker registration
- **WHEN** a visitor submits a valid email and password and at least one user already exists
- **THEN** a new User record is created with `role: WORKER` and `active: true`
- **THEN** the user is redirected to `/dashboard`

#### Scenario: First user becomes admin
- **WHEN** a visitor submits a valid email and password and no users exist in the database
- **THEN** a new User record is created with `role: ADMIN` and `active: true`
- **THEN** the user is redirected to `/admin`

#### Scenario: Duplicate email rejected
- **WHEN** a visitor submits an email already registered in the system
- **THEN** registration fails with a clear error message
- **THEN** no new User record is created

### Requirement: User login
The system SHALL allow registered users to log in with their email and password. On success, a JWT session token SHALL be issued and stored in an HTTP-only cookie.

#### Scenario: Successful login
- **WHEN** a registered active user submits correct credentials
- **THEN** a JWT session cookie is set
- **THEN** WORKER users are redirected to `/dashboard`
- **THEN** ADMIN users are redirected to `/admin`

#### Scenario: Inactive account rejected
- **WHEN** a user with `active: false` attempts to log in
- **THEN** login fails with an appropriate error message
- **THEN** no session is created

#### Scenario: Wrong credentials rejected
- **WHEN** a user submits an incorrect password or non-existent email
- **THEN** login fails with a generic error message (no hint about which field is wrong)

### Requirement: Session validation
The system SHALL validate the JWT session token on every request to a protected route. Validation MUST occur in Next.js middleware running on the Edge Runtime without accessing the database.

#### Scenario: Valid session passes middleware
- **WHEN** a request carries a valid, non-expired JWT session cookie
- **THEN** the request proceeds to the route handler

#### Scenario: Missing session redirects to login
- **WHEN** a request to a protected route has no session cookie
- **THEN** the middleware redirects to `/login`

#### Scenario: Expired session redirects to login
- **WHEN** a request carries an expired JWT session cookie
- **THEN** the middleware redirects to `/login`

### Requirement: User logout
The system SHALL allow authenticated users to log out. On logout, the session cookie SHALL be cleared.

#### Scenario: Successful logout
- **WHEN** an authenticated user triggers logout
- **THEN** the session cookie is cleared
- **THEN** the user is redirected to `/login`

### Requirement: Admin can deactivate users
The system SHALL allow ADMIN users to set any user's `active` field to `false`. A deactivated user SHALL be unable to log in.

#### Scenario: Deactivated user cannot log in
- **WHEN** an admin sets a user to `active: false`
- **THEN** that user cannot create a new session
- **THEN** any subsequent login attempt returns an error
