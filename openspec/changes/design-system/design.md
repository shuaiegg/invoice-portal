## Context

The foundation change established auth, DB, and route shells, but all pages are unstyled. This change establishes the visual layer before any feature UI is built. Getting tokens and components right now prevents inconsistency debt across all subsequent changes.

Key constraint: Tailwind v4 uses CSS-first configuration (`@theme` in CSS), not `tailwind.config.js`. shadcn/ui's Tailwind v4 support is in the `canary` channel as of mid-2026 — must verify before initializing.

## Goals / Non-Goals

**Goals:**
- Establish brand tokens as CSS custom properties usable as Tailwind utilities
- Initialize shadcn/ui with Tailwind v4 compatibility confirmed
- Build the shared component primitives all pages will import
- Deliver styled, functional auth pages (login + register)

**Non-Goals:**
- Page-specific layouts or feature UI (those belong to worker-portal and admin-portal changes)
- Dark mode (not in PRD)
- Animation or transition system

## Decisions

### D1: Tailwind v4 @theme for brand tokens

All brand colors defined as CSS custom properties in `globals.css`:

```css
@theme inline {
  --color-primary: #00A0FF;
  --color-text: #19191B;
  --color-secondary-text: #7B7E85;
  --color-accent: #F2F2F3;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --font-sans: var(--font-inter);
}
```

This makes `text-primary`, `bg-accent`, `text-error`, etc. available as Tailwind utility classes everywhere.

### D2: shadcn/ui canary for Tailwind v4 support

Run `npx shadcn@canary init` — this detects Tailwind v4 and generates components using CSS variables rather than `tailwind.config.js` theme extension. Must verify the generated `components.json` has `tailwind.cssVariables: true`.

### D3: Inter via next/font/google

Replace Geist with Inter using the existing `next/font/google` pattern already in `layout.tsx`. Inter is loaded as `--font-inter` CSS variable, referenced in `@theme` as `--font-sans`.

### D4: StatusBadge as a typed enum→variant map

```tsx
const statusConfig: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
  SUBMITTED: { label: 'Submitted', variant: 'secondary' },
  APPROVED:  { label: 'Approved',  variant: 'default' },   // primary blue
  PAID:      { label: 'Paid',      variant: 'success' },
  VOID:      { label: 'Void',      variant: 'destructive' },
}
```

Badge variants map to `--color-primary`, `--color-success`, etc. via shadcn's CSS variable system.

## Risks / Trade-offs

**shadcn canary instability** → Mitigation: pin the exact canary version used during init in `package.json`. Test all installed components render without errors before moving on.

**Inter font flash** → Mitigation: `next/font/google` with `display: 'swap'` and `preload: true` is sufficient for an internal tool.

## Migration Plan

1. Verify shadcn canary Tailwind v4 support with a test init in isolation
2. Update `globals.css` with brand tokens
3. Run `npx shadcn@canary init`, confirm CSS variable mode
4. Install components one by one, verify each builds
5. Create shared components (`StatusBadge`, `PageHeader`, `EmptyState`)
6. Wire login and register forms to BetterAuth client
7. Run `npm run build` — zero TypeScript errors required before marking done
