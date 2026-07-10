## ADDED Requirements

### Requirement: Color tokens defined in CSS
The system SHALL define all brand colors as Tailwind v4 CSS custom properties inside `@theme inline` in `globals.css`. No hardcoded hex values SHALL appear in component files — all colors MUST reference token names.

#### Scenario: All PRD colors available as Tailwind utilities
- **WHEN** a developer uses `text-primary`, `bg-accent`, or `text-success` in a component
- **THEN** Tailwind resolves the color to the correct brand hex value

#### Scenario: Token values match PRD specification
- **WHEN** the CSS is inspected in DevTools
- **THEN** `--color-primary` resolves to `#00A0FF`, `--color-text` to `#19191B`, `--color-secondary-text` to `#7B7E85`, `--color-accent` to `#F2F2F3`, `--color-success` to `#22C55E`, `--color-warning` to `#F59E0B`, `--color-error` to `#EF4444`

### Requirement: Typography token
The system SHALL configure Inter as the primary font family, loaded via `next/font/google`. The font variable SHALL be applied to the root `<html>` element and referenced in `@theme` as `--font-sans`.

#### Scenario: Inter renders as body font
- **WHEN** any page is loaded
- **THEN** body text renders in Inter, not Geist
