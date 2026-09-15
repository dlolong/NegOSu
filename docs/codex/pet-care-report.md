> Historical MVP report. The invitation-only scope below is superseded by [the standard-feature implementation](pet-care-release-report.md).

# NegOSu Pet Care developer report

Status: **INTERNAL DEMO READY**. Grooming only; invitation-only configuration. No general launch or production deployment recommendation.

Execution was by one Developer Agent, following AGENTS.md. No separate QA agent or independent review occurred. Existing staff, billing, branding, and UI work was preserved. The implementation/reuse matrix is in [pet-care-plan.md](pet-care-plan.md).

## Implementation and boundaries

- Core Customers remain pet owners. `pet_profiles` is an organization-level identity with one current primary customer, optional breed/date/size/coat/preferences, and internal owner-reported handling cautions. Pets are deactivated, not deleted through the UI.
- `pet_appointment_details` extends Core appointments with exactly one pet, original customer/name snapshots, and pickup/collection context. Owner changes cannot retarget active visits; old private links are revoked when ownership changes. Historical appointment customers and service price snapshots remain unchanged.
- Pet scheduling calls Core Scheduling and Availability through the existing persistence adapter. The transactional RPC saves the appointment and association together. Deferred constraints cover appointment, pet association, groomer, and resource assignments. Same-pet, staff, owner, branch, active-service, and resource checks run at the database boundary.
- Pet, staff, and resource locks protect simultaneous writes, including shared staff across branches. Core resource capacity uses peak simultaneous occupancy, with adjacent intervals treated correctly. The persisted `appointment_parallel_enabled` capability preserves the existing branch conflict default for Automotive/Salon while permitting appropriately assigned parallel Pet visits.
- Core statuses cover scheduling through grooming completion. Pet-owned `not_ready`, `ready`, and `collected` states remain separate. Collection records the authenticated operator. Payment and message sending do not advance collection.
- Appointment payments reuse the shared ledger, exact minor units, payment methods, partial/full payment rules, and retry keys. No Job Order is fabricated. Staff rescheduling retains the pet, services, price snapshots, and assignments. Dashboard finance is restricted to authorized roles and labels actual collections as “Payments Collected Today.”
- Private bearer links reuse the existing hash, encrypted delivery-secret store, expiration, revocation, metadata/cache protections, and public RPC. Pet actions require the current schedule revision. DTOs exclude handling notes and customer contact information. Public links cannot mark pets collected.
- Confirmation, reminder, and ready messages use the existing outbox, worker, and provider adapters. Recipients are owners, with explicit preferences. Missing contacts safely cancel delivery intents. Rescheduling invalidates pending messages; replacements get new deduplication identities. The worker rechecks eligibility before provider dispatch. Provider acceptance is not presented as proof of delivery.

## UI and files

New routes are `/dashboard/pet-care`, `/dashboard/pet-care/pets`, `/dashboard/pet-care/pets/[petId]`, `/dashboard/pet-care/appointments`, and `/dashboard/pet-care/appointments/[appointmentId]`. They provide pet add/edit dialogs; desktop tables/mobile cards; pet Overview, Appointments, and Grooming History; customer and staff rescheduling; visit transitions; payment entry; and private-link creation.

Shared business branding, owners, service catalog, staff, resources, inventory, billing, and onboarding are reused. Mobile navigation exposes Dashboard, Appointments, Pets, and More. Pet pages use regular-weight headings and actions. Shared onboarding loading no longer overflows narrow screens.

Principal additions: `modules/pet-care/`, `app/dashboard/pet-care/`, `components/pet-care-forms.tsx`, three migrations, `supabase/tests/pet_care.sql`, `tests/pet-care.test.ts`, `e2e/pet-care.spec.ts`, `scripts/qa-pet-care-fixture.ts`, and `scripts/test-pet-concurrency.py`. Shared changes are limited to industry/navigation/onboarding configuration, the scheduling/availability and payment/link SQL boundaries, notification composition, and reused presentation.

## Database and security

Append-only migration files:

1. `0070_pet_care_domain.sql`: explicit Pet tables, RLS, guarded relationships, transactional scheduling, collection, financial summary, and shared peak calculation.
2. `0071_shared_appointment_pilot_capabilities.sql`: privileged organization configuration and narrow shared appointment/link/payment extensions. Existing Salon display-name behavior remains compatible.
3. `0072_pet_care_customer_workflow.sql`: versioned public mutations and Pet message production/invalidation/eligibility.

No existing organization is converted or automatically opted in. The organization pilot flag, industry capabilities, paid entitlements, and staff permissions remain separate. Anonymous users receive no Pet table access. Ordinary organization users cannot change pilot/parallel flags. Server actions scope IDs to the active organization and accessible branches; RPCs independently enforce authorization.

SQL was executed **only in local Docker `supabase_db_karkr`**, first in disposable databases `negosu_pet_validation`, `negosu_pet_replay`, and `negosu_pet_final_replay`, then in the local app database `postgres` for browser verification. Prerequisites 0066–0069 and new migrations 0070–0072 were applied there. The original local app database was dumped before changes. One pre-existing local Auth fixture had NULL token fields that prevented Auth user lookup; those empty token fields were normalized locally. No hosted database, production configuration, or real customer data was changed. The local schema already had historical migration-ledger drift; these SQL runs are not evidence that a hosted migration ledger is current.

## Verification evidence

Evidence directory: `/private/tmp/negosu-pet-care-evidence/`. It contains private local configuration/backups as well as logs; do not commit or distribute the directory wholesale.

- Baseline: Node **v24.20.0**, npm ci, lint, typecheck, 310 tests, and production build passed before Pet implementation. Initial temporary logs were lost during the environment restart; these results were observed in the session, not reconstructed from new logs.
- Current unit suite: **317 passed**, including Pet identity/workflow/templates/architecture, shared peak occupancy, and cancellation before notification provider dispatch (`tests.log`).
- Pet SQL: **58 passed**, rollback-only (`regression-pet_care.sql.log`, `final-replay-pet-tests.log`). Final-source replay of 0066–0072 succeeded (`final-replay.log`).
- Concurrency: same pet, busy groomer, resource capacity, valid parallel pets, same pet across branches, and busy groomer across branches passed. Seven committed appointments; rejected attempts left no partial appointments (`pet-concurrency.log`).
- SQL regression sweep: **29 of 30 files passed** after fixing the Salon display-name regression. `phase03_04_operations_rls.sql` has three reproduced baseline failures: walk-in count differs, and two authorization-rejection tests expect a different error before the overlap check. These **MEDIUM / OUT OF SCOPE** baseline findings also fail against the unchanged pre-Pet local database (`baseline-operations.log`). Tenant violations still fail; this older fixture/test cleanup is outside the Pet implementation. Salon foundation, appointment payments, public booking, staff decoupling, scheduling assignments, Automotive work sessions, RLS, inventory, billing, branding, and reservation queue suites passed.
- Browser: Pet navigation, dialogs, Cancel/Escape, duplicate IDs, overflow, and public links checked at **320×740, 375×812, 390×844, 430×932, 1366×768, 1440×900**. The integrated test creates/edits a pet, books without a vehicle, confirms/reschedules as a guest, reschedules as staff, finishes grooming, marks ready, records a partial payment, and collects with a remaining balance. Public release routes and authenticated Automotive/Salon routes are also checked (`browser-final.log`, `browser-final-pet.log`; screenshots `pet-*.png`).
- Lint, typecheck, production build, and local production-build health passed (`lint.log`, `typecheck.log`, `build.log`, `health.log`). Browser-discovered payment conversion and mobile loading overflow were fixed and retested.

Commands used: `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, local `psql` regression/replay commands, `python3 scripts/test-pet-concurrency.py --apply-disposable-fixtures`, `npm run test:e2e -- e2e/pet-care.spec.ts e2e/release-smoke.spec.ts --project=desktop-chromium --workers=1`, and `HEALTHCHECK_URL=http://127.0.0.1:3105/health npm run release:health`.

The normal `npm run start` production environment gate correctly rejects localhost and QA variables. It was not weakened. For the **local production-build smoke only**, the built Next server was started directly on loopback port 3105.

## Local demo access

The current local app uses `http://127.0.0.1:3105`. Protected test values are in `/private/tmp/negosu-pet-care-evidence/local.env`; credentials are deliberately omitted here. Default repository `.env.local` points elsewhere, so do not run the seed without explicit local overrides.

In zsh, with local Supabase running and migrations 0066–0072 applied:

```sh
export PATH=/Users/mardi/.nvm/versions/node/v24.20.0/bin:$PATH
set -a
source /private/tmp/negosu-pet-care-evidence/local.env
set +a
npm run qa:seed -- --apply --pet-care
npm run build
./node_modules/.bin/next start --hostname 127.0.0.1 --port 3105
```

The seed is local-only, requires protected Pet QA emails/password, reuses the existing QA seed safety boundary, and does not dispatch notifications. It creates the two Pet businesses and existing Automotive/Salon QA businesses, synthetic catalog/resources, staff with differing contacts/account linkage, multiple pets per owner, operational visit states, and a partial payment. Reruns retain existing appointments.

Log in using the protected `QA_PET_OWNER_EMAIL` and `QA_OWNER_PASSWORD` values. The account selects **Milo Grooming QA** (`negosu-pet-qa-1`) through actual organization membership and opens `/dashboard/pet-care`. The second test account belongs to **Luna Grooming QA** (`negosu-pet-qa-2`), providing real isolation. If the server is already listening on 3105, use it rather than starting another instance.

## Rollout and remaining limits

**Internal demo only.** A hosted pilot still needs authorized migration review/application, trusted Pet organization provisioning and membership invitation through existing access controls, approved subscription selection, notification encryption/scheduler/provider setup, and the normal production environment, authenticated smoke, and manual release-checklist gates. No live messages or charges were sent. Paid capabilities were not enabled for real organizations; demo subscription rows are synthetic QA data using the existing catalog.

To disable a pilot, a trusted operator sets `organizations.pet_care_pilot_enabled=false` for that Pet organization. New Pet mutations and public capabilities fail closed; reference records remain readable, and notification eligibility rejects delivery. Do not convert the organization back to another industry or delete its records. Ordinary users cannot toggle this flag.

Deferred: separate calendar screen, standalone appointment-payment directory, large-list pagination/search beyond the current bounded appointment list, veterinary/boarding/daycare, multiple pets in one booking, and retail/consumption workflows. The pilot uses appointment detail payments and the shared neutral inventory pages. Full production delivery and hosted release validation remain unexecuted. No unresolved tenant leak, double-booking, or payment-corruption finding is accepted as a rollout risk.

## Public product pages follow-up — 2026-09-15

Pet Care now has a public `/pet-care` product page with grooming features, an illustrative visit preview, pilot inquiry, and existing-user sign-in. The home page, shared desktop/mobile navigation and footer, plans guidance, signup guidance, metadata, and sitemap include the grooming pilot. Marketing visibility is explicitly separate from the Automotive/Salon signup allowlist.

The inquiry opens the existing `sales@negosu.com` email contact with a Pet Care subject; it does not pretend to submit an application or grant access. This follow-up adds no database migrations, role changes, pricing changes, or public Pet booking directory. Existing tenant-owned private appointment pages are unchanged.

Validation evidence uses `marketing-build.log`, `marketing-lint.log`, `marketing-typecheck.log`, `marketing-tests.log`, `marketing-browser.log`, and `marketing-health.log` in the evidence directory. The browser suite exercises five public pages at the six required viewports plus 768px and 1024px tablet widths, inquiry/sign-in/navigation links, duplicate IDs, overflow, sitemap inclusion, and preserved signup restrictions.

Final results: 318 unit tests and 20 browser tests passed. Lint, typecheck, production build, local health check, and `git diff --check` passed. Self-review found and fixed inconsistent Pet Care section IDs before the successful browser rerun. No production deployment or hosted data changes were performed.
