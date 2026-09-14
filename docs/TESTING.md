# Testing

Catalog/category behavior is covered by `tests/service-categories.test.ts`, `supabase/tests/service_categories.sql`, and `e2e/service-catalog.spec.ts`. The SQL suite runs in a rollback-only transaction and checks owner/manager deletion, anonymous/advisor denials, cross-tenant writes, repeated deletion, and preservation of services/prices with null category assignments. No migration is required. The browser suite uses the shared synthetic form harness and checks Add/Edit/Delete dialogs, retained drafts on errors, confirmation, empty/read-only lists, long-text overflow, and explicit Back destinations at desktop/mobile widths. Run it alongside `e2e/form-actions.spec.ts` after changing shared buttons or dialogs.

Form actions are covered by `tests/form-actions.test.ts` and `e2e/form-actions.spec.ts`. The browser suite bundles the actual shared forms and application CSS, replacing server actions and Next navigation with synthetic boundaries. It does not contact the database. Run `npm run test:e2e -- e2e/form-actions.spec.ts` (set `PLAYWRIGHT_CHROME_PATH` if using installed Chrome). The suite uses Chromium for both desktop and mobile viewport projects. It checks clean Cancel destinations with list filters, invalid required fields, standalone returns, dialog Escape/close, controlled and uncontrolled resets, quick-create selection restoration, pending/duplicate submission behavior, icons, right alignment, and the customer save payload. It also saves customer edit screenshots in the Playwright results directory. These are component integration checks; production persistence remains covered by the existing action/domain/database suites.

Salon customer queues require a confirmed reservation; see Reservation queue access below for current tests and browser checks. Existing `tests/queue-display.test.ts` protects authenticated staff display behavior.

Salon public booking uses `tests/public-booking.test.ts` for industry-specific visitor validation, branch-local dates, and settings inputs, plus `supabase/tests/salon_public_booking.sql` for anonymous submission, published service/branch scope, full-duration availability, duplicate protection, authorized confirmation, vehicle-free appointments, and price/duration snapshots. Run the existing `phase10_public_booking_security.sql` and `salon_vertical_foundation.sql` suites after migration `0064` for backward compatibility. Browser verification should publish a synthetic Salon page and treatment through Settings, submit anonymously, correct invalid input without losing the selected time/contact details, confirm as staff, and inspect the private status link. Race two confirmations for one branch/time against a disposable database and require exactly one appointment. Use only local/disposable fixtures and remove them afterward.

The storefront and date-first calendar contract is covered by `tests/public-booking-calendar.test.ts`; SQL coverage in `supabase/tests/salon_public_booking.sql` verifies that only published businesses return date-level availability and that multi-treatment slots fit the complete combined duration. After migrations `0066` and `0067`, browser-check current/next-month navigation, empty months, one and multiple treatment selections, service/location changes, keyboard date/time selection, submission redirect, request confirmation/decline updates on the private status page, and the complete flow at 320, 375, 390, and 430 pixels. The calendar is advisory; submission must continue to fail safely if another request or staff action consumes the opening before submit.

## Release and authenticated smoke

`tests/release-readiness.test.ts` protects Node/release script contracts, local-only-by-default QA seed guards, production rejection, explicit remote-development confirmation, and cloud-neutral deployment documentation. `e2e/release-smoke.spec.ts` covers public entry routes and `/health`; after the guarded QA persona seed, `E2E_AUTHENTICATED=1` enables Automotive and Salon owner route smoke across the configured desktop and mobile projects. See `PILOT_QA.md` for exact commands and test-only credentials.

`tests/salon-operations.test.ts` covers the named Salon lifecycle, token/hash contract, neutral payment summary, reminder wording, and dependency direction. The Salon pgTAP suite covers job-function/role separation, Automotive-negative completion, public DTO/table denial, confirmation/reschedule, Appointment overpayment/reversal, and tenant boundaries.

The practical validation ladder is:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Pure TypeScript unit tests cover validation, money helpers, transitions, permissions, reporting, and platform configuration. `supabase/tests` contains SQL/RLS suites for cross-tenant denial, role restrictions, branch access, public/private boundaries, billing, and business workflows. Playwright covers important UI paths.

Database tests run only against the local disposable Supabase stack. Never reset or seed production. Seed fixtures must include at least two fake organizations so positive access and negative cross-tenant cases are both exercised.

A passing compile is not sufficient. High-risk changes need both an allowed-path assertion and denial assertions. Record commands actually run, warnings, environment blockers, and skipped suites in the final report.

Salon architecture coverage lives in `tests/salon-boundary.test.ts`, the expanded platform-foundation tests, and `supabase/tests/salon_vertical_foundation.sql`. It verifies fail-closed configuration, immutable tenant industry, direct public-action gating, industry navigation isolation, no static Salon-facing Automotive runtime imports, no Core-to-Salon dependency, no-vehicle Core appointment persistence, audited standalone appointment completion, Vehicle denial inside a Salon tenant, and cross-tenant Client/Appointment isolation.

Automotive Work Execution coverage includes the TypeScript status policy and service boundary plus `phase05_06_jobs_finance_rls.sql`. The database suite verifies atomic/idempotent queue conversion, authoritative item totals, assignment restrictions, job transitions, inspection ownership, finance boundaries, and cross-tenant denial.

`tests/work-tracking.test.ts` covers timestamp-derived elapsed time, summed technician labor effort, bounded action validation, and persistence delegation without browser-submitted duration. `supabase/tests/automotive_technician_work_sessions.sql` covers readiness-checked Start, actor-resolved technician identity, same-job idempotency, cross-job double-Start denial, assignment spoofing denial, pause/resume segmentation, Stop, completion blocking, cancellation cleanup, inactive technician history, assignment audit, direct-write denial, and tenant isolation. The partial unique index is the database concurrency boundary; validation should additionally race two local Start calls for the same technician and confirm one active row.

Core Availability unit tests cover end-exclusive overlap, containment, exact overlap, derived service duration, branch closure, service unavailability, appointment self-exclusion, industry-neutral input, and invalid timestamps. The appointment pgTAP suite verifies authoritative overlap denial, authorized override persistence, and adjacent intervals at the SQL boundary.
# Scheduling assignment coverage

`tests/availability.test.ts` covers staff conflicts, branch eligibility, resource capacity, adjacent intervals, and edit self-exclusion. `supabase/tests/scheduling_assignments.sql` covers schema constraints, valid persistence, cross-tenant and cross-branch denial, inactive resources, serialized conflict rejection, RLS visibility, and RPC-only assignment mutation.

`tests/work-execution.test.ts` locks the unchecked conversion default and explicit copy intent. `supabase/tests/automotive_scheduled_staff_transfer.sql` verifies no-copy conversion, explicit copy, inactive and cross-tenant denial, atomic failure, and idempotent retry behavior.

`tests/salon-operations.test.ts` and `supabase/tests/salon_vertical_foundation.sql` cover Salon lifecycle isolation, direct Automotive status-mutation denial, customer confirmation/reschedule, assigned-Staff allowlisting, reminder A→B→A/link-replacement identity, unchanged-save deduplication, normalized Staff/Treatment reminder refresh, idempotent Appointment payments, and invoice-less payment reversal. The existing Automotive finance pgTAP suite remains the regression boundary for invoice and Job Order payment behavior.

# Service Advisor coverage

`tests/service-advisor.test.ts` covers integer estimate totals, parts states, independent work blockers, payment status filtering, release readiness, and recommended actions. `supabase/tests/service_advisor_workflow.sql` exercises authorization snapshots/invalidation/audit, wrong-branch stock, shortage-blocked work, partial/final payment, paid release, branch restriction, and cross-tenant denial. The existing `phase05_06_jobs_finance_rls.sql` remains the compatibility suite and now saves its inspection before work starts.

# Digital estimate approval coverage

`tests/estimate-approval.test.ts` covers token shape, hash-only public validation, encrypted delivery-secret handling, the named expiry policy, and public DTO field stripping. `supabase/tests/customer_digital_estimate_approval.sql` covers creation, one-active-link replacement, anonymous allowlisting, no broad table access, invalid/expired/revoked/superseded states, approve/decline, idempotent retries, first-decision-wins behavior, revision invalidation, audit privacy, branch restriction, and cross-tenant denial.

# Notification outbox coverage

`tests/notifications.test.ts` covers email and Philippine-mobile normalization, current opt-out enforcement, AES-GCM delivery-secret protection, Automotive template injection, deterministic provider idempotency keys, accepted sends, retry/permanent failure, maximum-attempt behavior, production-safe provider selection, and cron bearer authentication. Providers are injected mocks; unit tests never contact a real delivery service.

`supabase/tests/notification_outbox.sql` covers transactional multi-channel enqueue, payload/token privacy, strict table grants, normalized destination snapshots, atomic claims, concurrent-claim denial, provider attempt accounting, future retry, stale-lease recovery, idempotent near-expiry reminders, approval cancellation, secret destruction, explicit opt-out, authorized manual retry, browser worker denial, and cross-tenant status denial.

# Vehicle maintenance coverage

Vehicle maintenance validation covers completion idempotency, approved-item-only snapshots, monotonic odometer behavior, one active projection per vehicle/service, interval snapshots, cross-tenant and branch denial, dismissal authorization, stage/channel notification deduplication, consent-ineligible rows, and cancellation after satisfaction. Database tests run only against a local or disposable Supabase database; the bounded historical backfill is never invoked by a migration.

`tests/maintenance-lifecycle.test.ts` covers established active appointment statuses, suppression precedence, snooze expiry, sent-stage preservation, legacy notification pausing, dry-run repository isolation, and the production apply guard. Scheduling unit tests verify that `maintenanceDueId` remains Automotive-only and an existing active link bypasses duplicate persistence.

`supabase/tests/maintenance_rebooking_backfill.sql` covers atomic create/link, duplicate-create idempotency, reschedule preservation, active appointment suppression, cancellation recovery, snooze/resume/audit, matching versus unrelated completed services, stage/channel deduplication, cross-tenant direct-mutation denial, zero-write dry-run planning, warning codes, explicit apply, no-notification backfill, and apply rerun idempotency. Run only after a fresh local migration apply.

`tests/parts-reservation.test.ts` covers the Core external-reference contract, Automotive adapter composition, reserve/consume/release delegation, and numeric precision validation. `supabase/tests/parts_reservation_consumption.sql` covers derived availability, full and partial allocation, insufficient-stock protection, idempotent retries and conflict detection, start gating, partial/over consumption, release semantics, cancellation and estimate-revision cleanup, actual-parts history, direct-write denial, tenant isolation, branch restrictions, and balance-helper disclosure protection. Concurrency safety is enforced by the inventory-item row lock; validation should also issue simultaneous final-unit reservation calls against a disposable database.

# Command Center coverage

`tests/command-center.test.ts` covers owner/manager scope, inaccessible branches, complete All Branches results, safe integer normalization, priority/age ordering, derived attention totals, Automotive and Salon action resolution, terminology, deep links, and the Core-to-vertical dependency boundary. `supabase/tests/command_center.sql` verifies paid revenue, branch-local Manila/New York date windows, invoice plus standalone Appointment outstanding balances, existing low-stock semantics, owner/restricted-manager role behavior, cross-tenant denial, and invalid branch scopes.

Run the SQL suite only on the local/disposable database after migration 0054. Dashboard browser validation should cover 320×800, 375×812, 390×844, 430×932, 1366×768, 1440×900, and 1920×1080, including no horizontal overflow, branch switching, direct links, staff financial isolation, empty/error states, and unique semantic DOM IDs.

# Optional Staff identity coverage

`tests/schema-compatibility.test.ts` covers rolling-schema detection for Command Center, Automotive work, Staff directories, and Appointment Staff assignments. Compatibility must activate only for exact missing-capability errors; authorization and unrelated database failures must remain visible. `tests/command-center.test.ts` also protects exact centavo aggregation in the pre-0054 metrics fallback.

`tests/staff-profile.test.ts` covers optional/normalized contacts, explicit login invitation input, shared notification eligibility, and Core dependency direction. `supabase/tests/staff_profile_login_decoupling.sql` covers both/mobile-only/email-only/neither persistence, stable linked IDs, independent operational/access branches, pending and accepted invitation linkage, Salon appointment assignment, Automotive Job/item/work-session assignment without login, tenant denial, and strict table/contact-column privileges. No Staff notification producer is introduced in this phase; the eligibility helper reuses the existing shared channel rules for future producers.

# Product experience coverage

`tests/product-experience.test.ts` protects the approved NegOSu landing message and calls to action, restrained public visual treatment, single-scroll auth/onboarding shell, compact Command Center hierarchy, visible non-color status labels, responsive Appointments and Services layouts, visible Inventory labels, stable CRM/public-booking IDs, and the neutral not-found experience. Run it with the shared design-system regressions:

```bash
node --import tsx --test tests/product-experience.test.ts tests/design-system.test.ts
```

Browser QA should inspect 320×800, 375×812, 390×844, 430×932, 640×960, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080. Verify one primary page scroll, no clipped dialogs or horizontal overflow, usable keyboard focus, readable labels, table-to-card transitions, primary-action hierarchy, and unique semantic IDs on both Automotive and Salon organizations. Public checks must include the homepage, vertical landings, authentication/onboarding, shop page, booking request/status, invitation acceptance, and the neutral 404 surface.

`tests/click-first-product-pages.test.ts` protects Reports section tabs/filter continuity, mobile daily records, Booking Request decision reachability, and Billing plan disclosure. `tests/design-system.test.ts` protects the compact five-group desktop hierarchy, subtle active state, four-item mobile navigation, grouped More popup, and sole main-content page scroll. Authenticated visual QA should additionally confirm that the common desktop menu fits at 1366×768 and that More, dialogs, and tabs remain keyboard reachable.

## Business branding

`tests/business-branding.test.ts` covers safe logo URLs, initials, image/attribution rendering, business metadata, and compatibility with older private appointment payloads. `supabase/tests/business_branding.sql` verifies owner/manager logo updates, cross-tenant and viewer denials, inactive membership, publication restrictions, and unknown private tokens. The public booking, public queue, Salon, and estimate SQL suites also verify their business-logo projections.

For browser checks, use synthetic businesses with distinct logos/names, a missing logo, a failed image URL, and a long name. Check business switching, settings preview, and desktop/320px/390px layouts. Confirm that the business remains visible at every width, the header stays compact, and no platform logo replaces the business identity. Saving or removing the logo in either settings screen must update the same business across the workspace and public pages.

## Reservation queue access

`tests/reservation-queue.test.ts` covers token-only lookup, malformed credentials, fail-closed errors, the retired public API, storefront link removal, and private response headers. `supabase/tests/reservation_queue.sql` verifies revoked direct RPC privileges, valid branch-scoped reservations, status/day restrictions, branch mismatches, publication/activity checks, and private-field/RLS protection. `public_salon_queue.sql` now tests the underlying restricted projection as the database owner; it no longer implies anonymous slug-based access.

Browser checks should confirm that storefront visitors and old bookmarked queue URLs see no queue, a valid reservation opens only its own branch, and cancellation or a denied polling response removes previously displayed queue data. Repeat the reservation display at desktop and mobile widths.

Inventory workspace regression: `npm run test:e2e -- e2e/inventory.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390`. Use the installed Chrome path via `PLAYWRIGHT_CHROME_PATH` and set `E2E_BASE_URL` when running fixture-only tests without the Next dev server. These tests compile the real inventory components and CSS with synthetic navigation/server-action boundaries. They exercise search/status filters, pagination, responsive stock cards/tables, optional product fields, error draft retention, Cancel/Back/Escape, pending submission controls, matching transfer choices, recipes, and empty/error/read-only/Salon states. `tests/inventory-workspace.test.ts` covers filter/stock status semantics, pagination bounds, transfer choices, safe return URLs, and expiry validation.

Run `supabase/tests/phase07_08_inventory_retention_rls.sql` and `supabase/tests/parts_reservation_consumption.sql` against the local test database for inventory RPC, tenant/branch, reservation, and transfer regressions; both roll back their fixtures. For authenticated integration smoke testing, create a test product, record opening stock and usage, transfer matching-SKU stock between accessible branches, verify branch-specific movement history, then try each dialog's Cancel without submitting. Do not use hosted customer data for these checks.

Clickable record regressions: `npm run test:e2e -- e2e/record-items.spec.ts e2e/inventory.spec.ts e2e/service-catalog.spec.ts e2e/form-actions.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`. The shared interaction fixture tests row/card body clicks, native-link keyboard navigation, independent Edit/Delete, input/checkbox/select interaction, copying text, and modifier/middle-click new tabs. Use Playwright's `ControlOrMeta` modifier so macOS exercises Command-click rather than Control-click's context menu. Catalog and inventory fixtures cover the real list components, right-aligned Edit, removed View controls, read-only product dialogs, and retained Cancel/Back behavior.

Authenticated smoke checks should include customer/vehicle related links, appointment rows, active technician work controls, booking review forms, queue transition forms, staff access controls, resource/branch activation, and maintenance actions. Verify that those controls do not also open the containing record. Check both Automotive and Salon roles, including read-only access. Existing database authorization remains authoritative; these navigation changes introduce no new mutation endpoint.

Dialog navigation: shared `FormDialog` headers contain one Close link and no duplicate Back link. The form regression suite checks this for its create/edit dialog fixtures; inventory and category regressions exercise Close while retaining list filters. Escape and footer Cancel still dismiss without saving. Standalone dashboard Back links continue to be tested separately.

Header alignment: `npm run test:e2e -- e2e/header-alignment.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`. The fixture compiles actual shared headers, category controls, dialogs, and CSS. Geometry assertions cover vertical centering, right-aligned actions, mixed button sizes, long headings/labels, nested action groups, mobile wrapping, constrained tablet/desktop content, and Close navigation. Inspect authenticated custom headers and public storefront sections during integration smoke testing; fixture checks do not exercise live tenant data.

Staff access layout regression: `npm run test:e2e -- e2e/staff-access.spec.ts e2e/form-actions.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`. Grant, replacement invitation, Manage access, and Staff profile fixtures cover both industries, full-width action rows/branch selectors, button alignment, long branch names, no horizontal overflow, Cancel navigation without mutation, and existing submit payloads. These are local component tests with synthetic server-action boundaries, not live invitations.

The staff-access browser suite also checks that the permission info box starts collapsed, expands with the keyboard, retains desktop/mobile role details for both industries, and does not overflow the viewport.

Billing availability: `tests/billing-overview.test.ts` covers missing provider columns/RPCs, scoped organization queries, valid provider intervals, per-plan drift, denied reads, null entitlement payloads, and empty catalogs. `e2e/billing.spec.ts` checks the actual billing view at desktop/320px/390px with missing setup, configured checkout, subscription failure, catalog failure, and empty results. Checkout calls are mocked; tests do not create real provider sessions or charges.
