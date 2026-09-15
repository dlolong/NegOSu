# Pet appointment detail and appointment walk-ins

## Bounded plan

Goal: match the existing Salon/Automotive detail layout for Pet Care and provide direct walk-in creation for Salon and Pet Care.

Reuse: Core appointment/service snapshots, staff/resource scheduling, vertical arrival transitions, shared form components, private payment and customer-link workflows. Automotive retains its vehicle queue.

Modules: Pet detail/list/dashboard/forms; shared visit form; Salon appointment entry/list/dashboard; a shared walk-in server action and transactional RPC.

Database: append-only migration 0078 adds a nullable request key and a scoped unique index to appointments, plus an authenticated RPC that creates and checks in a visit atomically. Existing rows remain unchanged. Database time determines arrival; retries return the same visit, and existing scheduling locks and validation apply.

Security: resolve workspace and branch server-side, require owner/manager/advisor and branch access in the database, validate pet/customer ownership and active records, retain RLS and staff/resource constraints. No production migration or deployment.

UX: searchable selectors, pending submission, retained errors/drafts, working Cancel, responsive headers and detail columns; source shown as walk-in. Pet-specific pickup and notes remain available.

Acceptance/validation: both new walk-ins create one checked-in appointment with no vehicle queue record; retries and conflicts are safe; foreign tenant/branch/role failures leave no partial visit. Test Pet detail actions and dialogs at desktop/mobile widths; run focused database/browser regressions and lint/typecheck/unit/build.

## Implementation and files

The Pet detail route `app/dashboard/pet-care/appointments/[appointmentId]/page.tsx` now matches the existing appointment structure: source/status header, scheduling assignments, visit details and service totals, actions, customer self-service, and payment summary. Grooming history remains available below the main details. Payment and note entry use dialogs with working Close/Cancel destinations. Rescheduling remains available for eligible visits; pickup, collection, and private notes keep their existing business rules. Assignment and payment loading errors are explicit. Responsive columns wrap long labels and stack on narrow screens.

Walk-in entry points were added to `app/dashboard/appointments/page.tsx`, `app/dashboard/appointments/new/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/pet-care/page.tsx`, and `app/dashboard/pet-care/appointments/page.tsx`. They reuse `components/operations-forms.tsx` and `components/pet-care-forms.tsx`, including searchable entity/service selections and pending submissions. The shared visit form now retains failed action drafts. `lib/dashboard-back-navigation.ts` suppresses redundant Back links for Salon appointment dialogs.

`app/dashboard/appointments/walk-in-actions.ts` authenticates membership, validates UUIDs/array/note bounds and branch access, and calls the new transaction. Error messages are allowlisted through existing Core/Pet error adapters. The SQL migration contains the authoritative scheduling/check-in operation; there is no browser-authoritative price, arrival timestamp, or status.

## Database and security

Migration `0078_appointment_walk_ins.sql` adds nullable `appointments.walk_in_request_id` and a unique organization/request index. Existing rows need no backfill. The new `create_appointment_walk_in` RPC derives organization and industry from an active branch and organization; requires authenticated owner/manager/advisor access to that branch; resolves a Pet's owner from its scoped active profile; and validates an active Salon customer. It reuses `save_pet_appointment` or `save_appointment_with_staff`, then the existing vertical arrival transition in one transaction. Branch hours must contain the complete service duration. Pet groomer/resource requirements, staff conflicts, service restrictions, branch locks, and resource capacity remain enforced.

A transaction advisory lock serializes the same organization's request key. The stored visit is returned only to its original creator with current access to its branch. Unique indexing provides an additional duplicate guard. There are no vehicle queue entries for these industries. The RPC uses a fixed search path, excludes anonymous execution, and retains all table RLS. No service-role credential is exposed to application clients.

Only isolated local/test database changes were made during this task. No hosted schema/data changes, deployments, payments to providers, or customer communications were performed.

## Verification

- `npm test`: 359 passed; updated existing navigation regression assertions.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed after the final visual adjustments.
- Six SQL suites (`appointment_trigger_identity`, `phase03_04_operations_rls`, `walk_in`, `pet_care`, `pet_care_release`, `appointment_walk_ins`) executed with `psql -v ON_ERROR_STOP=1`: 183 assertions passed.
- New `supabase/tests/appointment_walk_ins.sql`: 18 assertions covering both industries, server pricing/source/status, exact retries, conflict rollback, missing/foreign entities, tenant/branch/role isolation, closed hours, and anonymous denial.
- New `e2e/appointment-walk-ins.spec.ts`: four scenarios at 320px and 1440px. Covers entry and Cancel, failed-save draft retention, successful check-in, concurrent retries and concurrent first submissions producing one visit, conflicting arrivals, no vehicle queue records, note entry/discard, payment cancellation, Close navigation, and overflow checks.
- Existing `e2e/pet-care-release.spec.ts` updated to open the note dialog. Full public booking → staffed appointment → note → payment → grooming → collection passed. Normal Pet onboarding also passed.
- Combined browser run with the above, searchable appointments, Pet appointment errors, and Automotive walk-ins: 16 passed. All four new walk-in/detail scenarios passed again after the final visual adjustments.
- `git diff --check`: passed.
- Developer inspected screenshots at 320px and 1440px. Browser coverage uses Chromium; Safari was not exercised.

## Self-review and remaining limitation

Self-review checked new/untracked code and the existing dirty-tree changes without reverting prior work. Reviewed authorization, RLS, retry concurrency, transactional rollback, safe diagnostics, action availability, empty/error states, semantic IDs, and responsive alignment. Corrected test fixture assumptions (Salon uses a client selector and has no station fixture), removed redundant Salon Back links, improved payment-header alignment, and moved grooming history after primary visit actions for mobile navigation.

**HIGH — hosted availability is pending migration execution.** The new feature and previous trigger repair are implemented and validated locally. Hosted appointment/walk-in usability cannot be claimed until migrations 0077 and 0078 are applied through the authorized Supabase SQL/migration process and checked there. No hosted SQL migration connection is configured. This deployment requirement remains outside the executed local implementation; it is not a claim that the live workflow is repaired.

Recommended next step: apply the reviewed migrations through the hosted migration tooling, then verify a Salon and Pet Care walk-in in the intended workspace. Unrelated hosted migration-history gaps remain outside this bounded change.
