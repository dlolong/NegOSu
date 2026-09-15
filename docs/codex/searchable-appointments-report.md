# Searchable appointment entry — Developer Report

## Implementation

Appointment entry now searches customers by name, phone, or email and services by service or category name without navigating away. Missing customers, services, and categories have an explicit add/confirmation flow. Newly saved records are selected immediately. Multiple services remain supported, with duplicate selections prevented.

Customer and vehicle quick creation reuse the existing Core workflow. Pet Care can create an owner and pet inside the appointment draft. Catalog creation reuses existing service/category schemas and tables; price and duration are required for new services.

Searchable record controls also cover vehicle owners, pet owners, staff/resource assignments, public booking confirmation, service categories and compatible services, inventory transfers/recipes and estimate inventory links, job assignments/additional work, maintenance services, and resource branches. Inventory category suggestions use confirmation and persist with the product, consistent with the existing text category schema. Fixed workflow enums remain constrained choices.

## Files and modules

- Shared controls: `components/searchable-select.tsx`, `catalog-fields.tsx`, `inline-creation-guard.tsx`, `suggested-value-field.tsx`, `visit-entity-fields.tsx`, and `pet-visit-fields.tsx`.
- Form integration: `components/operations-forms.tsx`, `pet-care-forms.tsx`, `crm-forms.tsx`, and `inventory-forms.tsx`.
- Server/domain: `lib/record-lookup.ts`, `quick-catalog.ts`, `operations-data.ts`, `app/dashboard/appointments/entity-actions.ts`, `modules/pet-care/quick-pet.ts`, and `app/dashboard/pet-care/actions.ts`.
- Routes: appointment create/edit, walk-in creation, Pet appointment creation, booking requests, job detail/work, maintenance reminders, and resource create/edit.
- Tests: `tests/searchable-records.test.ts`; new searchable appointment and selector browser suites and fixture/helper; updated inventory and Pet browser workflows.
- Plan: `docs/codex/searchable-appointments-plan.md`.

## Database, business rules, and security

No migration or RLS change is required. Existing category/service uniqueness, foreign-key tenant guards, customer/vehicle/pet RLS, and Core scheduling remain authoritative.

Server actions resolve authenticated membership. Catalog writes require owner/manager access; customer, vehicle, and pet creation retain operator rules. Category and owner IDs are checked against the current organization and active state. Browser-supplied organization IDs are ignored. Search queries are scoped, bounded, and return explicit errors rather than implying a missing record when lookup fails.

Creation requests use stable UUIDs. Retries reuse only a matching existing insert and never overwrite another record. The live local integration test verifies simultaneous category/service retries and cross-tenant rejection using two authenticated tenants.

Shared appointment staff/resource options follow the selected branch. Editing loads preselected customer, vehicle, and service records even when outside the initial result page. Final service prices, appointment conflicts, capacity, and branch access continue through Core validation.

## UI review and fixes

Search results show descriptive text, keyboard selection, clear actions, loading/error/empty states, and required-selection validation. Typed text never becomes a record automatically. Inline cancellation restores the prior selection and preserves the enclosing draft; unfinished inline editors block enclosing form submission. Native reset restores initial selector values.

Self-review and browser testing found and fixed dropdown layout movement that could cause a click intended for a booking button to open its surrounding record card. Results now overlay the form, open above when necessary, and suppress option click propagation/default label activation. Stale search responses cannot replace a newer query.

All inline actions have semantic IDs and icons. Buttons wrap on narrow screens. New services start as standalone catalog entries available at all branches; advanced pricing, branch availability, and add-on configuration remain in Services. Confirmed new master records remain saved if the enclosing appointment is later cancelled.

## Validation

Commands used Node 24.20.0. Authenticated browser/integration work used only the protected local Supabase configuration and the local app at port 3105. No production data was changed and nothing was deployed.

- `npm test`: 333 passed, no skips.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build` with local validation environment: passed.
- `git diff --check`: passed.
- Combined desktop Chromium browser/integration regression: 41 passed, no skips. Includes inventory, Pet Care, searchable fields, public booking confirmation, and Automotive/Salon/public smoke checks.
- After the final search tokenization change, the targeted searchable appointment/selector suite passed all 7 tests, including the live database checks.
- Additional mobile Chromium regression: 12 passed across 320, 375, 390, and 430 px (selection/reset, inventory transfers, and category confirmation). Pet workflows also exercise desktop widths of 1366 and 1440 px.
- Manually reviewed actual appointment search and inline creation screenshots at 320 and 1440 px; no horizontal overflow.

Unit coverage includes validation, unauthorized roles, tenant filters, inactive/foreign category or owner rejection, money conversion, retry mismatch protection, safe query handling, multiword vehicle/customer search, category-name service matching, and explicit search errors. Browser coverage includes full appointment save/edit, creating and cancelling nested records, searchable inventory categories, multi-service selection, keyboard/clear/reset/Escape behavior, stale asynchronous results, failed search, and live database isolation/concurrency.

No new unresolved blocker or high-severity finding remains. No schema migration is needed. Deployment and real customer communications are outside this implementation. Review the changes and use the normal release process for deployment.
