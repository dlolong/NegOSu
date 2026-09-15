# Appointment repair and industry starter catalogs

## Implementation summary and current status

Starter catalogs are installed in all seven configured hosted workspaces, following the user's explicit authorization. The import added 69 services: 40 across four Automotive workspaces, 19 across two Salon workspaces, and 10 in Pet Care. One matching Salon service was preserved instead of duplicated. Every workspace now has at least ten active services. Verification confirmed existing service names, prices, durations, active states, and public visibility were unchanged; every newly inserted service is private.

The reported appointment failure is now identified: the actual development log records PostgreSQL `42703`, `missing field new.appointment_id`, during `appointment.save`. The user reproduced this in Facial Care. Shared parent appointment rows use `id`; child assignment/detail rows use `appointment_id`. Migration 0077 repairs the shared Pet integrity trigger's row identity dispatch. It has been applied and tested locally; it has **not** been applied to the hosted database. The configured REST credentials cannot execute SQL DDL, and no hosted database migration connection is available. The original hosted save workflow therefore remains unverified and incomplete pending this migration.

## Files and behavior

- `modules/core/catalog/starter-services.ts`: ten templates each for Automotive, Salon, and Pet Care, with categories, durations, and editable sample PHP prices.
- `modules/core/catalog/install-starter-services.ts`: additive installer reusing Core service/category tables, existing unique constraints, and authenticated RLS. Preserves existing records, skips normalized name matches, and ignores concurrent insertion conflicts.
- `app/dashboard/operations-actions.ts`, `app/dashboard/services/page.tsx`: owner/manager catalog import with a responsive preview, clear sample-price/private-visibility explanation, Cancel, pending submission, and semantic DOM IDs.
- `app/onboarding/actions.ts`: installs the industry catalog after successful organization/owner membership creation. A failure leaves onboarding usable and import retry available through Services.
- `scripts/install-starter-services.ts`: guarded local/development dry-run/apply command. The hosted import used a separately bounded invocation of the same installer under the explicit all-seven-workspaces authorization.
- `lib/errors/action-error.ts`: serialized operation/code diagnostics and allowlisted missing-field identifiers; no raw database messages, SQL, failing rows, or customer values.
- `app/dashboard/pet-care/actions.ts`, `app/dashboard/pet-care/appointments/page.tsx`, `components/pet-care-forms.tsx`, `modules/pet-care/runtime.ts`, `modules/pet-care/scheduling-errors.ts`: specific safe scheduling errors, branch hours display, and retained form drafts on save failure.
- `supabase/migrations/0077_pet_appointment_trigger_row_identity.sql`: function-only repair; resolves the appropriate identity from the actual trigger row and validates both parents when an assignment moves.
- Tests listed below, this report, and `docs/PRODUCT_ENTRY.md`.

## Database, business rules, and security

Migration 0077 replaces `check_pet_appointment_integrity()` without changing tables, existing data, RLS, or deferred triggers. It retains `assert_pet_appointment`, its locking, and authoritative scheduling constraints. Unexpected trigger targets and missing identities fail closed. The function keeps a fixed search path and is not directly executable by public application roles.

Pet groomer/resource assignments remain required. Tenant boundaries, branch access, operating hours, service eligibility, overlap checks, and resource capacity remain enforced. A 10 AM start alone did not establish the failure's cause; the missing trigger field is the confirmed database diagnostic.

Catalog industry/currency and application membership are resolved server-side. Non-owner/manager imports are rejected. Prices are PHP setup examples, not market quotations; unsupported currencies are rejected. New services are active internally but hidden from public booking. Category and service insertion are separate operations, so an interrupted import may leave reusable categories; retries preserve existing rows. The authorized hosted import checked the seven-workspace scope before writes and verified each workspace afterward.

No hosted SQL migration, production deployment, customer communication, or charge was performed. Earlier migration 0076 corrects queue source labels and remains subject to the hosted migration process.

## Tests and validation

Executed using Node 24 and the isolated local Supabase/application environment:

- `npm test`: **359 passed**.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- SQL suites executed with `psql -v ON_ERROR_STOP=1`: `appointment_trigger_identity.sql` (4), `phase03_04_operations_rls.sql` (48), `walk_in.sql` (12), `pet_care.sql` (58), and `pet_care_release.sql` (43): **165 assertions passed** after applying migration 0077 locally.
- `npx playwright test e2e/searchable-appointments.spec.ts e2e/starter-services.spec.ts e2e/walk-in.spec.ts e2e/pet-appointment-errors.spec.ts --project=desktop-chromium --workers=1`: **15 passed** against the final rebuilt application and repaired local database.

New regression coverage includes `tests/starter-services.test.ts`, `tests/action-error.test.ts`, `tests/pet-scheduling-errors.test.ts`, `e2e/starter-services.spec.ts`, `e2e/pet-appointment-errors.spec.ts`, and `supabase/tests/appointment_trigger_identity.sql`. The SQL trigger regression forces deferred constraints to run before rollback and checks Automotive appointment creation/update, walk-in creation, and Salon appointments without vehicles.

Browser coverage includes catalog preview/Cancel/Add at 320px and 1440px, Automotive appointment creation using a starter service, Salon appointment creation/editing, Pet owner/pet creation, failed Pet scheduling with draft preservation followed by successful correction, walk-in creation/correction, concurrent queue numbering, repeat imports without overwrites, and authenticated foreign-tenant lookup rejection. Mobile checks use Chromium viewport emulation; Safari was not tested.

The local catalog installation separately added 94 services across ten fixture workspaces. Hosted verification subsequently confirmed the authorized 69 additions across all seven requested workspaces and preservation of existing service values.

## Self-review, remaining risk, and next step

Self-review covered the changed trigger, server authorization, tenant filters, preservation of existing catalog records, retry behavior, safe error handling, retained form drafts, and responsive action placement. A transient formatter import error was corrected before final successful validation. No security rules were relaxed.

**HIGH — hosted workflow unresolved; repair implemented and locally validated.** Apply the reviewed `0077_pet_appointment_trigger_row_identity.sql` through the hosted Supabase SQL/migration tooling, then verify appointment creation and walk-in creation there. No hosted SQL connection is available in this environment, so hosted application of the repair and post-migration verification could not be completed. This is not an accepted claim that the live workflow works.

Other observed hosted migration-history gaps are outside this targeted repair and were not changed. Review the sample service prices and durations before using them for real customers or enabling public booking.
