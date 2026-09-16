# Apartelle & Inn implementation plan

> Historical implementation record. The later standard-availability update supersedes the invitation requirement; see `docs/HOSPITALITY.md` and migration 0090.

Goal: a controlled hospitality pilot with real organizations, rooms, guests, immediate stays, manual charges, guest collections, supplies, reports and staff. Single Developer execution; no deployment or hosted writes.

## Classification and boundaries
- REUSE EXISTING CORE: auth, organizations/branches, Customers (Guests), Staff and optional contacts/login, inventory ledger, invoice/payment ledger and reversal semantics, report date/filter/CSV helpers, Command Center UI/contracts, audit, subscription catalog and Billing & Plan.
- CONFIGURE EXISTING CORE: hospitality industry capabilities, role-aware navigation, shared page composition, onboarding and trusted pilot provisioning.
- NEW HOSPITALITY DOMAIN: rooms, stays, immutable occupancy snapshots, explicit stay-to-invoice relationship, front-desk RPCs/UI and report projections.
- SMALL SHARED EXTRACTION REQUIRED: neutral manual invoices and idempotent invoice payment recording; existing Automotive invoice operations remain compatible.
- DEFERRED: reservations, online booking/payment, deposits, automatic rates/stock deductions, housekeeping, accounting/profit and integrations.

## Modules and database impact
Append-only Core finance and Hospitality migrations. Core invoices may reference a job or be neutral manual bills. Hospitality owns association to stays. Composite keys and guards enforce tenant/branch alignment. Partial unique index enforces one active stay per room. All writes use transactional RPCs, authenticated role/branch checks, actor attribution and audit. No public occupancy/guest/financial access. No Core imports of Hospitality.

## Business and UI rules
Room occupancy and debt are separate. Server check-in/out timestamps, locked room selection, retry-safe writes. Initial charge is atomic or stay is unpriced; zero is priced. Manual integer-centavo amounts only. Financial reads/writes follow existing finance roles; reports enforce plan scope and never query money for other roles. Checkout requires debt acknowledgment. Bounded report aggregation covers full scope; details paginate. Branch-local date windows. Shared dialogs/tables/buttons, searchable guest selection, stable IDs and responsive layouts.

## Rollout/backward compatibility
Trusted database pilot access controls new hospitality organization creation. Existing organization switching remains authoritative. No public general launch, SaaS prices/provider configuration changes or production mutation. Preserve existing Automotive/Salon/Pet Care workflows and historical records.

## Validation/acceptance
Local disposable migrations and guarded synthetic fixtures. Unit tests plus SQL/RLS/idempotency/integrity tests, actual concurrent check-in/payment races, existing finance/inventory/staff/entitlement regressions. Browser workflows at 375×812, 390×844, 1366×768. Lint, typecheck, tests and production build. Explicit self-review of diff, grants, RPCs, branch/tenant boundaries, financial data exposure and UI. Document commands actually run and remaining limits.
