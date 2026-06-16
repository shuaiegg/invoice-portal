## ADDED Requirements

### Requirement: shadcn/ui initialized with Tailwind v4
The system SHALL initialize shadcn/ui using the Tailwind v4-compatible command (`npx shadcn@canary init`). The generated `components/ui/` directory SHALL contain components that reference the brand token CSS variables, not hardcoded colors.

#### Scenario: shadcn components use brand tokens
- **WHEN** a `<Button variant="default">` renders
- **THEN** its background references `--color-primary` from the CSS theme

### Requirement: Core components available
The system SHALL have the following shadcn/ui components installed and available for import from `@/components/ui/`: Button, Input, Select, Textarea, Table (+ TableHeader, TableBody, TableRow, TableCell, TableHead), Badge, Card (+ CardHeader, CardContent, CardFooter), Dialog (+ DialogTrigger, DialogContent, DialogHeader, DialogTitle), Tabs (+ TabsList, TabsTrigger, TabsContent), Label, Separator.

#### Scenario: Components import without error
- **WHEN** any page imports from `@/components/ui/button`
- **THEN** the import resolves and TypeScript reports no errors

### Requirement: StatusBadge component
The system SHALL provide a `components/shared/status-badge.tsx` component that accepts an `InvoiceStatus` value and renders a `<Badge>` with the correct color variant: `SUBMITTED` → grey/secondary, `APPROVED` → blue/primary, `PAID` → green/success, `VOID` → red/destructive.

#### Scenario: Each status maps to correct color
- **WHEN** `<StatusBadge status="PAID" />` renders
- **THEN** the badge displays green styling

#### Scenario: Unknown status falls back gracefully
- **WHEN** an unexpected status value is passed
- **THEN** the component renders a neutral grey badge without throwing

### Requirement: PageHeader and EmptyState components
The system SHALL provide `components/shared/page-header.tsx` (title + optional subtitle + optional action slot) and `components/shared/empty-state.tsx` (icon + message + optional CTA button) for consistent page layout across all routes.

#### Scenario: PageHeader renders title and action
- **WHEN** `<PageHeader title="My Invoices" action={<Button>New Invoice</Button>} />` is used
- **THEN** the title and button render side by side at the top of the page
