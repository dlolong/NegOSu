# Scheduled reminders

## Implementation

Extended the existing `/dashboard/customers/reminders` page instead of introducing a duplicate reminder system. A dashboard discovery shortcut opens All scheduled (all pending reminders, including overdue). Existing Due now, Upcoming, Contacted and Cancelled views remain available. The new Due within 24h / overdue view matches the notification timing rule. Search, pagination, branch-local display times and existing resolution actions are reused.

Owners, managers and advisors receive an active-branch in-app bell category for pending client reminders starting exactly 24 hours before due time. Existing bell polling refreshes every 30 seconds while visible, on focus and when opened. Overdue reminders stay visible until contacted or cancelled. This is an in-app attention indicator, not an offline push, email or SMS delivery system. Other automated customer-message schedules are outside this client-follow-up feature.

## Files and boundaries

- `app/dashboard/customers/reminders/page.tsx`: additional list views and explanatory copy.
- `components/dashboard-discovery-content.tsx`: shared dashboard shortcut.
- `components/admin-notification-bell.tsx`: reminder category icon.
- `modules/platform/admin-attention.ts`: scoped reminder count.
- `modules/core/crm/client-reminders.ts`: shared 24-hour cutoff.
- `tests/admin-attention.test.ts`: scope, timing, status, role and unavailable-source coverage.
- `e2e/dashboard-discovery.spec.ts`: shortcut assertion and correction of an outdated feature-link assertion.

No database migrations, RLS changes, dependencies, production operations or new mutations. Reminder reads retain authenticated RLS; the page explicitly scopes organization and RLS restricts branches. Bell reads additionally scope the active branch. Existing database RPCs retain authorization, idempotency and concurrency enforcement for creation/resolution. Counts are computed from current pending records, so no duplicate notification writes occur.

## Self-review

Reviewed the diff, membership scoping, RLS policies, role restrictions, pending-status filtering, inclusive 24-hour boundary, retained overdue records, partial-error behavior, pagination, semantic IDs and wrapping styles. Existing reminder URLs retain their default Due now behavior. All scheduled is explicitly selected by the new shortcut. No known blocking code finding. Live RLS and authenticated integration behavior were not exercised for this change.

## Validation

- `npm test`: passed, but the existing glob selected only two nested tests in this environment.
- `node --import tsx --test tests/*.test.ts`: all 580 root-level tests passed before adding the final boundary case.
- `node --import tsx --test tests/admin-attention.test.ts tests/client-reminders.test.ts`: all 12 tests passed, including the added boundary case and final shared cutoff.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm run build -- --webpack`: passed, including TypeScript validation.
- Default `npm run build`: blocked by Turbopack worker port permissions, including the elevated retry.
- Desktop/mobile browser fixtures: Chrome launch blocked by sandbox; elevated browser execution declined. Responsive layout received code review only.

## Next step

Run the desktop/mobile browser suites and authenticated reminder lifecycle on a disposable test environment before release. Confirm bell visibility at the 24-hour boundary and clearing after contact/cancellation. No deployment performed.
