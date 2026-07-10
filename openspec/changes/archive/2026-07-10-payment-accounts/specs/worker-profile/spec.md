## MODIFIED Requirements

### Requirement: Worker profile displays payment methods
The profile page SHALL display a dedicated "Payment Methods" section that lists the worker's payment accounts as cards. Each card shows the account type, optional label, key detail fields, and a preferred badge if applicable. Workers can add new accounts, edit existing ones, and delete them from this section.

The section SHALL replace the current flat payment fields (paymentMethod dropdown, paymentAccount, bankName, swiftCode, postCode, secondaryPayment, paypalEmail, cryptoCoin, cryptoNetwork, cryptoWallet) with the new account card list.

#### Scenario: Worker with no accounts sees empty state
- **WHEN** worker visits /profile and has no payment accounts
- **THEN** the Payment Methods section shows an empty state with an "Add Payment Method" button

#### Scenario: Worker adds an account from profile
- **WHEN** worker clicks "Add Payment Method", selects a type, fills required fields, and saves
- **THEN** a new card appears in the Payment Methods section for that account

#### Scenario: Worker sets preferred from profile
- **WHEN** worker clicks "Set as Preferred" on an account card
- **THEN** that card shows a "Preferred" badge and any previously preferred card loses it

#### Scenario: Type-specific fields shown on add/edit
- **WHEN** worker selects "Crypto" as type in the add/edit form
- **THEN** only Coin, Network, and Wallet Address fields are shown (not bank or email fields)

#### Scenario: Worker deletes an account from profile
- **WHEN** worker clicks delete on an account card and confirms
- **THEN** the card is removed from the list

## REMOVED Requirements

### Requirement: Flat payment fields on worker profile
**Reason**: Replaced by the new PaymentAccount card-based UI. Flat fields (paymentMethod, paymentAccount, bankName, swiftCode, postCode, secondaryPayment, paypalEmail, cryptoCoin, cryptoNetwork, cryptoWallet) are no longer editable through the profile form.
**Migration**: Workers should re-enter their payment details using the new "Add Payment Method" flow. Legacy fields remain in the database until a data-migration follow-on task removes them.
