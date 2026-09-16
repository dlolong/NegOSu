# Checkout and room cleaning

Implemented the requested transition: **Occupied → Cleaning → Available**. Checkout immediately removes the room from arrival availability; staff confirm housekeeping is finished with **Mark ready**. Existing stay balances and payment behavior are preserved.

## Files and implementation

- `supabase/migrations/0092_hospitality_room_cleaning.sql`: append-only cleaning flag, checkout-cycle association, completion actor/time, tenant/branch foreign key and pending-cycle constraint. Checkout sets cleaning in the same transaction. A locked trigger blocks active stays in dirty rooms. The scoped readiness RPC supports safe retries and rejects stale/occupied-room confirmations. Existing RLS/grants are retained; availability view remains security-invoker. Reports/exports count cleaning separately.
- `app/dashboard/hospitality/{actions.ts,rooms/page.tsx,stays/[stayId]/page.tsx}`: server validation, Cleaning tab, row/detail actions, ready confirmation dialog, clear checkout wording and safe error messages. Cancel actions, pending submission and semantic DOM IDs reuse shared components.
- `modules/hospitality/{contracts.ts,report-export.ts}`, `components/hospitality/{overview.tsx,report.tsx}`: room counts and CSV include Cleaning; it is excluded from Available.
- `lib/rbac.ts`: existing Operations Staff access supports housekeeping completion without rate editing or financial access. Owners/managers, Front Desk and cashiers may also complete cleaning; viewers remain read-only. Housekeeper is a staff job function, not a new authorization role.
- Local seed, integration, unit and browser tests updated; domain, deployment and permission docs explain the new flow.

## Self-review and security

Reviewed transaction lock order, checkout retries after readiness, stale readiness after later checkout, same-cycle duplicate completion, branch/tenant authorization, inactive room behavior, data constraints, trigger restrictions, RLS view, inherited report scope/entitlements and UI null/error states. Completion uses the expected departed stay ID, so an older open dialog cannot release the next cleaning cycle. Readiness of an inactive room does not activate it. No client-supplied status or actor is trusted.

Existing rooms retain their current readiness on migration; historical checkout rows are not retroactively interpreted as dirty. Future checkout requires cleaning. No significant unresolved self-review findings.

## Validation

Executed using Node 24 and guarded local Supabase credentials:

- `npm test`: **396 passed**.
- `npm run check`: lint, typecheck and optimized production build passed.
- `node --import tsx scripts/hospitality-seed.ts`: passed, adds a synthetic Housekeeper/Operations Staff account.
- `node --import tsx scripts/test-hospitality.ts`: **86 passed**, including cleaning availability, server check-in rejection, viewer/tenant/branch denials, concurrent duplicate readiness, stable completion timestamp, late checkout retry, stale later-cycle rejection, room report/CSV consistency and the existing payment/occupancy/legacy-record regression matrix.
- Local PostgreSQL `hospitality_general_availability.sql` and `phase05_06_jobs_finance_rls.sql`: **70 assertions passed**, no TAP failures.
- Migration 0092 applied transactionally to both local fixture and separate upgrade replay databases after 0091.
- Playwright `e2e/hospitality.spec.ts` on desktop Chromium, 320px and 390px mobile: **11 passed**, 4 deliberate mobile skips for switch/redirect checks already covered on desktop. Includes cashier checkout → housekeeper cleaning confirmation → cashier arrival availability, cancel/focus/scroll lock, no page overflow and financial access regression. Desktop/mobile room screenshots inspected.
- Review found a shrinking action icon at 320px; adjusted the Mark ready label to wrap while preserving icon size. Final-build handoff rerun: 3 passed (desktop/320px/390px); added 320px icon-width and page-overflow assertion: 1 passed. Ready dialog and final mobile list screenshots inspected.
- `git diff --check` and new migration/document whitespace checks passed. Owned test server on port 3105 stopped after validation.
- INFO: the local Next server logged “destination stream closed early” during automated navigation. All workflow assertions passed and no server-action failure was logged; framework stream-cancellation diagnostics were not changed in this feature.

## Rollout and scope

No hosted mutation, deployment, real customer communication or payment was performed. Apply migration **0092** before deploying this UI. Existing room prices and stays are preserved; there is no production backfill. Use Rooms → Cleaning → Mark ready, with Housekeeper staff given Operations Staff access to the appropriate branches.

Task assignment, housekeeping checklists and automatic room release remain outside this request. Mobile tests use Chromium emulation; physical-device Safari and production operation are not claimed.

## Follow-up: combined Rooms table

Available, Occupied, Cleaning and Inactive rooms now appear together in the default Rooms table. The separate status/admin tabs were removed; Stay history remains separate. Desktop has a status column; mobile places the status badge below the room name. Actions remain on the right: Check in, Check out, Mark ready and authorized room editing. Existing status-tab bookmarks display the combined table. Search, pagination and tenant/branch restrictions remain active.

Changed the Rooms page, ready-action return URL, Overview room link, domain documentation and browser regression coverage. No schema, RLS or payment-rule change was needed. Self-review found no unresolved issue in this follow-up. `npm run check` passed (lint/typecheck/build); lint/typecheck rerun after test additions passed; `git diff --check` passed. Hospitality browser suite: 14 passed across desktop/320px/390px, 4 deliberate desktop-only test duplicates skipped. New coverage creates all three operational states, verifies them in one table, tests the row actions and checkout cancellation, and confirms old status links no longer filter the table. Desktop/mobile screenshots inspected. Local test server stopped; no hosted deployment performed.
