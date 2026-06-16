## 1. Tailwind v4 Brand Tokens

- [ ] 1.1 Remove existing dark-mode `@media` block and placeholder variables from `globals.css`
- [ ] 1.2 Add brand color tokens to `@theme inline` block: `--color-primary`, `--color-text`, `--color-secondary-text`, `--color-accent`, `--color-success`, `--color-warning`, `--color-error`
- [ ] 1.3 Replace Geist font import in `app/layout.tsx` with Inter via `next/font/google`
- [ ] 1.4 Add `--font-inter` CSS variable to `@theme inline` as `--font-sans`
- [ ] 1.5 Verify `text-primary`, `bg-accent`, `text-error` work in a test component

## 2. shadcn/ui Initialization

- [ ] 2.1 Check shadcn canary release notes for Tailwind v4 compatibility confirmation
- [ ] 2.2 Run `npx shadcn@canary init` — select TypeScript, use `@/` alias, CSS variables mode
- [ ] 2.3 Verify generated `components.json` has `tailwind.cssVariables: true`
- [ ] 2.4 Confirm `components/ui/` directory is created and imports work

## 3. Core Component Installation

- [ ] 3.1 Install: `npx shadcn@canary add button input label`
- [ ] 3.2 Install: `npx shadcn@canary add select textarea separator`
- [ ] 3.3 Install: `npx shadcn@canary add card badge dialog`
- [ ] 3.4 Install: `npx shadcn@canary add table tabs`
- [ ] 3.5 Run `npm run build` — confirm zero TypeScript errors after all installs

## 4. Shared Components

- [ ] 4.1 Create `components/shared/status-badge.tsx` — maps `InvoiceStatus` enum to Badge variant (SUBMITTED→secondary, APPROVED→default/blue, PAID→success, VOID→destructive)
- [ ] 4.2 Create `components/shared/page-header.tsx` — accepts `title`, optional `subtitle`, optional `action` slot (renders right-aligned)
- [ ] 4.3 Create `components/shared/empty-state.tsx` — accepts `message` and optional `action` (CTA button)

## 5. Auth Pages UI

- [ ] 5.1 Install BetterAuth client helper: `npm install better-auth` client-side (if not already a dependency)
- [ ] 5.2 Create `lib/auth-client.ts` — BetterAuth client instance for use in `'use client'` components
- [ ] 5.3 Update `app/(auth)/login/page.tsx` — styled centered card, email + password inputs, submit button, link to register, loading state, inline error display
- [ ] 5.4 Wire login form to `authClient.signIn.email()` — on success redirect to `/dashboard` or `/admin` based on role
- [ ] 5.5 Update `app/(auth)/register/page.tsx` — styled centered card, name + email + password inputs, link to login
- [ ] 5.6 Wire register form to `authClient.signUp.email()` — on success redirect based on role

## 6. Layout Polish

- [ ] 6.1 Update `app/(worker)/layout.tsx` — add styled nav bar with links: Dashboard, Profile, New Invoice; logout button
- [ ] 6.2 Update `app/(admin)/layout.tsx` — add styled nav bar with links: Dashboard, Workers, Invoices, Settings; logout button
- [ ] 6.3 Verify both layouts render without errors when visited as authenticated user

## 7. Verification

- [ ] 7.1 Open `/login` — confirm Inter font, brand colors, card layout
- [ ] 7.2 Register a user — confirm styled form, success redirect
- [ ] 7.3 Login — confirm loading state and redirect
- [ ] 7.4 Render `<StatusBadge status="PAID" />` in a test page — confirm green badge
- [ ] 7.5 Run `npm run build` — zero errors
