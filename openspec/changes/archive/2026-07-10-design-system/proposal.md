## Why

The foundation layer provides route shells and auth, but every page is unstyled. Before any feature UI can be built, the design system must be established: brand tokens wired into Tailwind v4, shadcn/ui initialized with those tokens, and the shared UI primitives that all pages will use. Doing this as a dedicated change ensures consistent visual language across worker and admin surfaces.

## What Changes

- Define brand color tokens and typography in `globals.css` using Tailwind v4 `@theme` syntax
- Initialize shadcn/ui (verify Tailwind v4 compatibility, use `npx shadcn@canary init`)
- Switch root font from Geist to Inter (per PRD typography spec)
- Install and configure core shadcn/ui components: Button, Input, Select, Textarea, Table, Badge, Card, Dialog, Tabs, Label, Separator
- Create shared layout components: `PageHeader`, `StatusBadge` (invoice status → color mapping), `EmptyState`
- Update `app/layout.tsx` to use Inter font
- Update auth page shells with minimal styled forms (login, register)

## Capabilities

### New Capabilities

- `brand-tokens`: Tailwind v4 CSS custom properties for all PRD-specified colors and typography. All components reference these tokens — no hardcoded hex values in component files.
- `component-library`: shadcn/ui initialized and configured. Core components available for use across all pages. `StatusBadge` maps `InvoiceStatus` enum values to colors: Submitted→grey, Approved→blue, Paid→green, Void/Rejected→red.
- `auth-ui`: Styled login and registration forms wired to BetterAuth client. Handles loading states, error messages, and redirects.

### Modified Capabilities

## Impact

- **New dependencies**: `@fontsource/inter` or Next.js `next/font/google` for Inter, shadcn/ui component files
- **Modified files**: `app/globals.css` (add brand tokens), `app/layout.tsx` (switch font), `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- **New files**: `components/ui/*` (shadcn), `components/shared/page-header.tsx`, `components/shared/status-badge.tsx`, `components/shared/empty-state.tsx`
- **No API or database changes**
