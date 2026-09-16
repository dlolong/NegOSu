# Apartelle cashier arrival implementation

The arrival workflow is now available rooms → fixed stay period → receive payment/show change → occupied → explicit checkout/vacant. Guest name and customer profile are optional. Supported periods are 3, 6, 12 hours, daily (24 hours), weekly (7 days). An administrator enables and prices the periods each room offers.

## Changes and business rules

- `supabase/migrations/0091_hospitality_cashier_check_in.sql`: append-only room rates/version, optional guest association, paid-period timestamps, protected immutable arrival/rate snapshots, Core cash tender/change fields, atomic paid arrival RPC and RLS-invoker availability view. Cashiers gain checkout; the old arbitrary-price check-in RPC is revoked. Existing stays and invoices are preserved.
- `modules/hospitality/contracts.ts`, `app/dashboard/hospitality/actions.ts`: validate packages, cash, optional identity and permissions; resolve tenant/branch from authenticated context. Owner/manager manage rates; owner/manager/cashier check in. Server locks and request keys protect occupancy/payment against races and retries; stale rates require refresh.
- Rooms page, `room-rates-editor.tsx`, `paid-check-in-form.tsx`: Available/Occupied/Administration/History tabs, five configurable packages, fixed price preview, insufficient-cash validation, change preview, optional collapsed guest fields, pending submit, right-aligned cancel/save and semantic IDs.
- Stay detail and statement show the paid period and original cash/change. Room remains occupied after the paid period expires until staff check out. Refunds, additional charges and old outstanding balances retain shared Core behavior. Revenue excludes returned cash change. No inventory consumption or external payment transaction is initiated.
- Guest detail actions and role descriptions align with cashier access. Overview, homepage, solution page, deployment and domain docs describe the revised workflow.

## Security and self-review

Reviewed tenant/branch guards, old RPC revocation, rate edit permissions, table grants, view RLS, finance-only snapshot/cash access, guest foreign keys, integer-centavo arithmetic, room locks, duplicate-request locking, stale price handling, null guest rendering, existing history and responsive dialogs. Rate snapshots remain independent of later room edits. No BLOCKER/HIGH findings remain from performed checks.

Fixed during review: old Front Desk check-in copy/actions; cash-summary wrapping for large amounts; a local integration assertion that looked for a historical payment only on the first paginated report page. That assertion now checks the full authorized export.

## Validation

Executed with Node 24 and guarded local Supabase credentials (never hosted `.env.local` credentials):

- `npm test`: 395 passed.
- `npm run check` (lint, typecheck, build): passed.
- `node --import tsx scripts/hospitality-seed.ts`: additive synthetic fixtures, including cashier and legacy stays.
- `node --import tsx scripts/test-hospitality.ts`: 76 integration assertions passed. Includes all five durations, optional names, two-session occupancy and payment races, exact duplicate arrival retries, rate snapshots/version rejection, cash invariant, checkout/vacancy, authorization, tenant/branch isolation, full-scope reports/export and preserved Core inventory behavior.
- Local PostgreSQL suites `hospitality_general_availability.sql`, `platform_product_entry.sql`, `phase05_06_jobs_finance_rls.sql`, `salon_appointment_vehicle_optional.sql`, `pet_care_release.sql`: 135 assertions passed, no TAP failures.
- Migration 0091 applied transactionally to local fixture database and separate upgrade replay database after 0090.
- Playwright `e2e/hospitality.spec.ts` + `e2e/hospitality-entry.spec.ts`, desktop Chromium, 320px/390px mobile, one worker: 15 passed, 6 deliberate mobile skips for desktop-only signup/switch/redirect tests. Covers normal signup, room rate setup, unnamed cashier arrival, cash change/statement, explicit checkout, legacy financial workflows, report access, dialog focus/background scroll lock, cancel and overflow. Desktop and 320px screenshots inspected.
- Final optimized-build cashier browser rerun after review fixes: 3 passed (desktop, 320px, 390px). Owned test server on port 3105 stopped after validation.
- `git diff --check`: clean.

## Rollout and limitations

Migration and UI are local/reviewable; no hosted schema/data mutation, deployment or real customer charge was performed. Apply migrations through 0091 before the new UI, coordinate the arrival workflow cutover, then configure actual room rates in Rooms administration. Existing rooms are intentionally not assigned invented prices. Unpriced legacy stays remain readable and can receive charges/payments.

Daily/weekly are elapsed 24-hour/7-day packages. Automatic checkout, overstay charges, extensions, future reservations and external payment processing remain outside this requested cashier workflow. All observed browser tests use Chromium/mobile emulation; physical-device Safari and production rollout were not tested.
