# Walk-in submission investigation and fixes

## Findings and implementation

The reported generic failure comes from the `create_walk_in` RPC error branch. An ordinary Automotive walk-in succeeded in both the existing SQL test and a browser submission before this fix, so the user's exact failing selection/environment has not been confirmed. A branch-unavailable service reproduces that failure path locally.

Walk-in submission now translates known service, vehicle/customer, permission, and missing-function failures into safe instructions. Unknown failures log an operation name and error code without customer data, SQL, or raw database messages. Failed submissions keep the complete draft mounted, including notes and searchable selections. React's automatic successful-action form reset is suppressed for this dedicated form; successful submissions still navigate to the queue. The existing pending submit button and Cancel destination are reused. Membership and branch checks occur before legacy inline entity resolution.

A separate confirmed defect was found in `enqueue_appointment`: migration 0029 had replaced migration 0012's source handling with a hardcoded appointment source. New append-only migration 0076 restores walk-in source labels and explicitly checks authenticated branch access. It preserves the appointment lock, atomic queue counter, transaction, service snapshots, existing statuses, and RPC signature. Existing rows are not backfilled. RLS and tenant guards remain unchanged; anonymous enqueue execution is revoked.

## Files

- `app/dashboard/operations-actions.ts`: validated action and safe error diagnostics.
- `app/dashboard/queue/new/page.tsx`, `components/walk-in-form.tsx`: dedicated draft-preserving form wrapper.
- `lib/errors/walk-in-error.ts`, `tests/walk-in-error.test.ts`: allowlisted user-facing error translation and regression tests.
- `supabase/migrations/0076_walk_in_queue_source.sql`: source and explicit branch authorization correction.
- `supabase/tests/walk_in.sql`: rollback, unavailable service, tenant/branch/anonymous access checks.
- `supabase/tests/phase03_04_operations_rls.sql`: isolate two foreign-record assertions from an unrelated schedule overlap so they exercise the intended integrity guards.
- `e2e/walk-in.spec.ts`: successful submissions, rejection/correction, preserved fields, Cancel, narrow/wide layout, and concurrent queue numbers.

## Validation and self-review

All database and authenticated browser tests used the isolated local Supabase and local app. Migration 0076 was applied only to that local database. No hosted data or configuration was changed; nothing was deployed.

- `npm test`: 353 passed.
- `npm run lint`: passed, including final test additions.
- `npm run typecheck`: passed, including final test additions.
- `npm run build` with local validation environment: passed.
- SQL through `docker exec ... psql -v ON_ERROR_STOP=1`: 48 existing operations assertions and 12 focused walk-in assertions passed (60 total).
- `playwright test e2e/walk-in.spec.ts --project=desktop-chromium --workers=1`: 5 passed. Covers 320px and 1440px, corrected submission creating exactly one appointment, preserved price snapshots, and three simultaneous walk-ins receiving consecutive distinct numbers.
- `git diff --check`: passed.

Self-review confirmed that no business validation moved into the browser, failed RPC transactions leave no partial appointments or queue counter allocations, and the UI retains rather than silently resets failed drafts. Initial test-only failures were corrected: a one-to-one queue relationship was asserted as an array, the Next route announcer also matches `role=alert`, and privileged counter inspection needed explicit fixture scoping. A mobile WebKit run stalled during launch and was stopped; final narrow-screen coverage used Chromium at 320px, not Safari.

## Remaining limits and next step

The exact original user failure remains unconfirmed without its selection/environment or a new error from the updated form. A read-only attempt to inspect the configured hosted API schema returned HTTP 401 and provided no schema evidence; no mutating hosted RPC was called. Do not interpret the source-label correction as proof that it caused the original submission failure.

Release the reviewed application changes and migration 0076 through the normal deployment process. The migration has not been applied to the hosted database. Recheck the originally failing walk-in with the new specific feedback. Existing historical queue source values are deliberately not modified, and request-level idempotency for separate repeated walk-in RPC calls is unchanged; the form prevents concurrent button submissions and queue numbering remains serialized.
