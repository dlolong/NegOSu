# Workspace lists Developer Report

## Implementation summary

Applied the Payments table/tab conventions to Inventory, Services/Treatments and Categories, Booking Requests, Staff and Invitations, My Work, Appointments, Pets, Jobs, Customers/Clients, Vehicles, Resources, Branches and Maintenance.

Collections use shared responsive tables with native record links, secondary actions on the right, readable mobile metadata, consistent borders/headings and meaningful route-based tabs. Existing filtering and pagination remain in place. Booking requests now open their review controls in the request dialog instead of rendering every confirmation form in the list.

## Files / modules changed

- New `components/record-table.tsx`, `components/list-tabs.tsx` and `lib/list-navigation.ts` compose the existing Table, Tabs and RecordRow/RecordLink primitives.
- Updated `components/inventory-workspace.tsx`, `components/service-catalog.tsx` and `components/staff-management.tsx`.
- Updated dashboard list pages: `services`, `bookings`, `my-work`, `appointments`, `jobs`, `customers`, `vehicles`, `reminders`, `pet-care/pets`, `pet-care/appointments`, `settings/staff`, `settings/resources` and `settings/branches`.
- Added `tests/list-navigation.test.ts` and `e2e/workspace-lists.spec.ts`.
- Updated existing category, inventory and Pet release browser checks, and UI/source contract tests for the shared responsive table composition.
- Updated `docs/UI_CONVENTIONS.md`; bounded plan in `docs/codex/workspace-lists-plan.md`.

## UI / UX and compatibility

- Inventory: Stock and History tabs, product and movement tables, retained search/category/stock filters, pagination, details and movement/transfer/recipe dialogs.
- Services/Treatments: clean catalog/category tabs, responsive tables, category Add above the list and Edit/Delete on the right.
- Booking Requests: Pending, Confirmed, Declined and All tabs; searchable customer/reference/service/pet fields; contextual review dialog. Closing preserves filters. Confirmed requests do not expose review forms.
- Staff: Directory and Invitations tabs, responsive staff/schedule/invitation tables, existing profile and system access dialogs, quiet permission reference.
- My Work: Working, Assigned and History tabs. Existing Pause/Stop actions remain authoritative; historical job numbers are fetched in one scoped batch.
- Appointments: Day/Week tabs with one date/status/search toolbar; shared table layout for Automotive and Salon. Pet appointments have progress tabs and their existing date/search filters.
- Customers/Clients, Vehicles, Pets, Resources and Branches: responsive tables and status tabs. Automotive resource creation now uses the same dialog pattern as service businesses.
- Maintenance: Due services and Service intervals tabs replace the side-by-side list/form layout.

Native record links retain keyboard and modifier-click behavior. Secondary links/forms act independently. Mobile metadata uses distinct IDs where necessary; tables retain captions and column headings. Dialog and standalone routes stay available. Read-only columns avoid repeating amounts/statuses in two columns.

## Database, business rules and security / RLS

No migration, schema change or RLS change. No production data or deployment changes. Existing domain services and server mutation actions are reused, including booking review, inventory idempotency/stock validation, staff access checks and technician work transitions.

Reviewed organization/branch scoping, selected-record resolution and role gates. My Work history reads explicitly filter both organization and active branch and use the authenticated client. Tab URLs preserve list filters, reset pagination and omit transient dialogs, notices and invitation tokens. No client-authoritative business rules or privileged data readers were added.

## Tests and commands run

- `npm test`: **351 passed**, including three new list-navigation behavior tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed using the isolated local test environment.
- `git diff --check`: passed.

Browser validation used the protected local environment wrapper, synthetic local data and Chromium:

```sh
npx playwright test e2e/inventory.spec.ts e2e/service-catalog.spec.ts e2e/staff-access.spec.ts e2e/record-items.spec.ts --project=desktop-chromium --project=mobile-320 --workers=2
npx playwright test e2e/inventory.spec.ts --project=desktop-chromium --project=mobile-320 --workers=1
npx playwright test e2e/workspace-lists.spec.ts e2e/release-smoke.spec.ts e2e/searchable-appointments.spec.ts e2e/pet-care-release.spec.ts --grep-invert 'new Pet Care business' --project=desktop-chromium --workers=1
npx playwright test e2e/workspace-lists.spec.ts --project=desktop-chromium --workers=1
```

Across the final focused runs, **101 distinct browser scenarios passed**:

- 28 Inventory scenarios on desktop/320px, including long metadata, filters, movements, transfer selection, recipes, idempotent retry, duplicate-submit protection, details and Cancel/Close.
- 54 category/catalog, staff-access and record-interaction scenarios on desktop/320px, including validation failures, read-only/empty states, confirmation, keyboard and independent row actions.
- 3 authenticated cross-industry list scenarios covering the affected directories, tab selection, table overflow at 320/768/1024/1440px, record navigation, inventory/staff Cancel, confirmed-booking dialog Close and My Work history.
- 11 public/authenticated release smoke scenarios.
- 4 searchable appointment/catalog scenarios, including tenant isolation and concurrent retry behavior.
- 1 public Pet booking-to-appointment-to-payment scenario through the new review dialog.

The combined component run passed 81 scenarios and exposed one timing-sensitive Inventory geometry assertion. It captured changing locator indexes as searchable options closed. Replaced it with one synchronous geometry snapshot; all 28 Inventory scenarios then passed. Earlier movement-history coverage also caught removed semantic date markup, which was restored and verified at both widths.

The combined workflow run passed 16 scenarios before the local database VM stopped; the remaining three list scenarios failed through login/database unavailability. Restored the isolated environment and reran all three successfully. These failures are not represented as a clean combined run. Desktop and phone screenshots were visually reviewed in addition to overflow assertions.

## Self-review findings and known limits

Fixed semantic date markup, redundant appointment range controls, duplicate read-only columns and stale source/test assumptions about mobile cards. Reviewed row/action independence, contextual dialog navigation, empty/error states and scoped server reads. No unresolved blocker or high finding identified for this change.

Existing data-query limits remain unchanged; this is a presentation refinement, not a redesign of all directory data loading. Other browser engines and hosted deployment were not validated. SQL/RLS definitions were unchanged, so the full database suite was not rerun. Purpose-built queue boards, command-center dashboards, reports, public pages and record-detail workflows remain outside this directory-layout scope.

Recommended next step: review the updated pages in the workspace. No additional database setup is required for this refinement.
