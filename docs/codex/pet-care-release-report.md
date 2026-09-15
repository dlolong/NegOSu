# Pet Care standard-feature Developer Report

Date: 2026-09-15. Single Developer Agent; no delegation.

## Implementation summary

Pet Care is a supported grooming product with normal signup and business/branch onboarding. Invitation-only messaging and runtime access conditions are removed. The deprecated database flag is retained for older readers but no longer controls access. Existing organizations, memberships, plans and grooming records are preserved.

The usable workflow is: create a Pet Care business → configure shared services, staff and resources → register owners/pets or receive a public request → confirm a staffed grooming appointment → record visit observations → collect payment → finish grooming → mark ready → record collection. Private customer links support confirmation and rescheduling.

## Files and modules

- Platform: `modules/platform/{brand,product-entry,onboarding,industry,navigation,plan-catalog}.ts`, signup selector, auth validation, public marketing and metadata.
- Shared public booking: `lib/public-booking.ts`, `app/shop/[slug]`, `app/dashboard/bookings` and Core request persistence.
- Pet operations: `modules/pet-care`, `components/pet-care-forms.tsx`, `app/dashboard/pet-care`, shared owner details and appointment route redirects.
- Tests: Pet unit/schema tests, branding expectations, Pet browser tests and new `e2e/pet-care-release.spec.ts`, `supabase/tests/pet_care_release.sql`, concurrency script. Existing notification assertions now select their fixture tenant rather than unrelated outbox rows.
- Documentation: README, product entry, industry modules, database guide, release plan and this report. Earlier MVP report is retained as historical evidence and marked superseded.

## Database and business rules

New append-only migrations: **0073** and **0074**. Earlier migration files were preserved.

0073 extends validated first-organization creation to `pet_grooming` and `pet_spa`, uses the existing Free plan, enables parallel resource scheduling for Pet Care, and removes pilot predicates from shared appointment payments and customer links. Industry/configuration changes remain protected.

0074 extends Core public requests with a subject discriminator and adds `pet_booking_details` and `pet_grooming_notes`. Public intake reuses Core rate limits, normalized contact details, service validation, snapshots and duplicate prevention. Separate pets can request the same time. Requests do not reserve capacity; staff confirmation checks pet ownership, branch, services, groomer and resource availability transactionally.

Staff can explicitly select a matching existing pet or create a new owner/pet from the request. New intake is not silently merged into private customer records using a name alone. Grooming notes retain authorship and an optional recommended return date. Repeated confirmations and identical note writes are idempotent. Notes are append-only; corrections are additional notes. Pet deactivation and owner archival cannot strand active visits.

## UI and UX

Public Pet Care CTAs now open standard signup. Business-owned storefronts show the business identity, Pet intake and booking status; they expose no public queue or pet directory. Owner pages link pets and use the correct grooming booking form. Generic appointment routes redirect Pet users to their grooming workflow.

New operational screens include pet/date/progress filters with paginated appointment lists, a paginated payment directory using the shared ledger, and grooming notes in visit detail/history. Shared form actions, cancel links, icons and responsive record components are reused. Recommended return dates are recorded guidance, not automatically scheduled recurring bookings.

## Security / RLS self-review

New tables have RLS and restricted grants. Anonymous intake cannot supply internal customer/pet IDs. Mutations derive organization, branch and author from authenticated records; private RPCs remain inaccessible to anonymous callers. Tests cover unauthorized tenant/branch access, private notes, mismatched pets, retry payload changes, authoritative pricing, and active-record archival. No production data, authentication configuration, messages or charges were changed.

Fixed during review: contact normalization mismatch when matching existing owners, same-owner/different-pet request collisions, active pet/owner archival, and shared owner links leading to the wrong appointment form. Local encryption-key configuration and two test-scoping issues were also corrected. No new unresolved BLOCKER or HIGH finding remains.

## Commands and validation

Executed using Node 24.20.0 and the local Supabase Docker stack:

| Check | Actual result |
| --- | --- |
| `npm test` | 322 passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run release:env` | Passed for development |
| `npm run release:health` | Passed at local port 3105 |
| `git diff --check` | Passed |
| Playwright Pet marketing, operations, release workflow, and shared release smoke | 29 passed; no skipped tests |
| Existing Pet SQL suite | 58 passed |
| New Pet release SQL suite | 43 passed |
| All SQL suites via `psql -v ON_ERROR_STOP=1`, checking TAP failures | 30 of 31 suites passed |
| Final migrations replayed from a pre-change local database backup | Passed |
| Multi-session concurrency script on disposable final replay database | Passed: pet, groomer and resource conflicts; cross-branch conflicts; parallel different pets; duplicate public requests; confirmation retries; note retries |

Browser checks cover 320, 375, 390, 430, 768, 1024, 1366 and 1440px public layouts, six operational viewport sizes, overflow/duplicate IDs, dialogs/cancel, new-business onboarding, public intake through payment/collection, and private customer confirmation/rescheduling. Mobile schedule screenshot was visually reviewed.

Evidence is stored locally under `/private/tmp/negosu-pet-release/`. Local credentials and database backups there are protected and are not repository artifacts. Providers were disabled; no real messages were dispatched.

## Known risks and out-of-scope work

**MEDIUM — OUT OF SCOPE:** `phase03_04_operations_rls.sql` has three pre-existing failures (assertions 40, 43, 44): walk-in queue expectations and expected error ordering for foreign customer/vehicle IDs. The same failures were reproduced on the pre-change database backup. Other Automotive/Salon SQL suites and authenticated browser smoke passed. This is not an all-green repository SQL result.

This release covers grooming operations. Veterinary medicine, boarding, daycare, automatic recurring bookings, and pet retail checkout are separate extensions. Hosted deployment and live provider delivery were not exercised. Public pages and reminders continue to require the existing plan entitlements and configured delivery channels. Existing bounded owner/service/staff selectors retain platform query limits.

## Recommended next step

Review and apply all pending migrations in order, including 0070–0074, to the intended environment before deploying the application. Run authenticated release smoke there using approved accounts. No production deployment was performed.
