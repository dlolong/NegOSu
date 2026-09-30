# Booking alternatives and customer agreement

Business review now offers Suggest an alternative alongside normal confirmation/decline. A proposal contains a branch-local date/time, optional named staff member (required groomer/resource for pet care), and a customer-facing message. Customers may request a staff member by name in the existing booking notes. The private status link shows the latest proposal with Accept alternative and Cancel booking. As explicitly requested, acceptance returns to the business for final confirmation; it does not reserve capacity or immediately confirm an appointment. Dashboard filters distinguish Awaiting client and Client accepted. Staff can revise a proposal, which requires fresh customer agreement.

Implementation: `app/dashboard/bookings/{page,actions}.tsx/ts`, `app/booking/[token]/{page,actions}.tsx/ts`, `components/booking-alternative-response.tsx`, the booking notes label, shared alternative input validation/error mapping, append-only migration 0108, and unit/SQL/browser regressions. No unrelated prior work was reverted.

Migration `0108_booking_alternatives.sql` adds versioned proposal history with RLS inherited through the scoped request. Public users cannot query the table or call the private validator. Staff proposal/finalization RPCs enforce booking-management permission and branch access. Customer responses require the existing unguessable booking token and exact latest version. Changed offers, duplicate submissions and terminal-state transitions are guarded; identical retries return the original result. Request row and branch scheduling locks serialize the new workflow. New availability checks reuse canonical service duration and branch hours/occupancy checks, validate active staff/branch/resource eligibility, and check staff/resource overlap. Suggestions and acceptance do not create appointments or stock movements. Finalization reuses canonical salon/automotive or pet confirmation and retains accepted promo snapshots. Deferred assignment checks ensure agreed time/staff/resource are attached on final confirmation, including calls through older review paths. Broader scheduling behavior remains that of the existing scheduler.

Self-review fixes: client buttons use one pending state to prevent simultaneous responses; old confirmation RPCs cannot bypass a pending offer; accepted offers are version checked; public errors omit database details; proposed staff names are resolved server-side; the business's final confirmation can occur within the intake's one-hour lead window provided the appointment is still in the future. Token privacy copy now explains response/cancellation capability. The proposal status is separate from the existing request enum to preserve ordinary requests, pending duplicate protection and compatibility.

Validation executed: 486 unit tests passed; all 39 rollback-only database assertions passed after the final migration adjustment. SQL coverage includes anonymous/cross-tenant/cross-branch denial, foreign staff, helper/table privacy, stale versions, idempotent proposal/accept/cancel/finalization, cancellation after confirmation denial, client agreement enforcement, agreed staff assignment, multi-service promo price preservation and pet groomer/resource confirmation. Four mocked client response browser tests passed on desktop and mobile-320. `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`, and `git diff --check` passed. Business review layout was inspected in code; its full live browser flow and concurrent multi-session stress tests were not run. No claim of hosted end-to-end validation.

Deployment / manual check: review and apply migration 0108 after 0107, then restart/redeploy the application normally. Migration execution during validation was rolled back; the configured hosted database was not changed and nothing was deployed. Open a pending request in Dashboard → Booking requests, propose another time/staff, open the customer's private link, accept, then confirm from Client accepted. Also check replacing a proposal before acceptance and cancelling a pending alternative. Suggestions appear on that status page, which refreshes automatically; no email/SMS delivery was added or sent. Confirmed-appointment cancellation/rescheduling, multiple simultaneous alternatives, and automatic slot holds are outside this change.

---

# Public catalog horizontal rows

The public storefront now displays promos in one horizontal card row and services in independent rows grouped by their existing category name. Uncategorized services use Other services (Other treatments for salons). Shared `PublicCardRow` provides native touch/trackpad scrolling, keyboard-focusable regions, scroll snapping, and responsive card widths. At the user’s request, previous/next arrows and their client-side scroll tracking were removed; rows now render without client JavaScript. Existing card IDs, booking URLs, images, prices, descriptions, and durations are preserved. No database, RLS, authorization, booking or pricing behavior changed.

Files: public shop page, `public-card-row.tsx`, `public-service-categories.tsx`, `public-promo-cards.tsx`, public calendar source regression, and the public catalog row browser fixture/spec. Self-review checked category grouping, uncategorized fallback, semantic heading order, stable IDs, overflow containment, and independent native scrolling. Browser execution was blocked by sandbox Chrome restrictions and permission was declined; desktop/mobile layout and interaction tests were added but are not claimed as passing. Validation: lint, typecheck, production webpack build and diff whitespace checks passed. The full unit run had 482 passing tests and one stale source-location assertion; after updating that assertion for the extracted component, all seven tests in the affected suite passed. No deployment or migrations were performed.

---

# Multiple-service promo update

Promo components now support multiple distinct services with optional products/supplies. The form explains combined durations and a single fixed price. Service-only bundles with at least two services are valid; products-only offers and mixed accommodation/service bundles remain unsupported. Hospitality keeps its existing one-accommodation contract. Public promos are limited to 10 included services to match canonical public booking limits.

Files/modules: commerce schema, error mapper and appointment promo loader; staff service picker; public selection, review, cards and booking page; accepted promo summary; `0107_multi_service_promos.sql`; unit, SQL and desktop/mobile fixture regressions. Earlier uncommitted project work was preserved.

Database/business rules: append-only migration 0107 replaces catalog validation and the shared offer resolver, updates both booking adapters and public projections, and removes only the unique appointment/promo constraint so each included service can retain its own immutable allocation. Existing snapshot rows are unchanged. A bundle price is split equally in integer minor units, with remainder units assigned in service-ID order. The allocations sum exactly to the fixed price, including prices smaller than the service count. Public and staff summaries regroup those allocations into one promo. Existing duration checks and deferred edit guards protect every included service. Catalog changes do not rewrite accepted terms. Stock is unchanged.

Security review: existing RLS, RPC execution privileges, owner/manager catalog authorization, staff/branch restrictions, public intake limits and idempotency remain in force. The offer helper remains private. Every service must belong to the business, be active and available in the selected branch; public requests additionally require every service to be published. Missing services and overlapping promo selections fail server-side. Public projections exclude internal supplies. Single-service public responses retain their compatible shape with additional `serviceIds`; application readers accept older single-service responses during setup.

Validation actually executed: all 483 unit tests passed (`node --import tsx --test tests/*.test.ts`). After the final public-service-limit adjustment, 14 focused commerce/public selection/error tests passed. `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`, and `git diff --check` passed. Self-review corrected public bundle aggregation, review totals, and the selection summary so the fixed price is shown once. No known blocking code defect remains from static review; database execution and browser behavior remain unverified.

Validation limits: added `supabase/tests/multi_service_promos.sql` covers authorization, duplicate components, cross-tenant services, complete selection, visibility and branch eligibility for the second service, exact odd-centavo allocation, public confirmation after catalog changes, immutable components, staff booking and idempotency. Added browser cases cover component types, all submitted service IDs, replacement of overlapping selections, and a single review price on desktop/mobile-320. Docker access failed in the sandbox and escalation was declined. Chrome could not launch in the sandbox and escalation was declined. These new SQL/browser tests are NOT claimed as passing; the 0106 SQL regression suite also was not rerun.

Next step: run the new SQL suite and existing commerce/appointment/public suites against a disposable database, then review and apply migration 0107 after 0106. No migration was applied to a local or hosted database by this update, and nothing was deployed. In the promo editor, select Service for each desired component and choose different services. Save one fixed price. Public booking additionally requires Active status, Show on public website, all included services published, and branch online bookings enabled. Deferred fulfillment, walk-in, maintenance, job-invoice and hospitality transaction integrations remain outside this change.

---

Historical report for migration 0106 follows.

# Public promo images and booking wizard update

Promo creation/editing now accepts an optional image URL and reuses `ImageUploadField` for direct uploads. URL entry remains available on every plan; the existing `/api/dashboard/images` endpoint still enforces paid upload entitlement, permissions, file limits and tenant storage scope. A controlled “Show on public website” checkbox opts each offer into publication; existing promos default to private.

The storefront displays public promo cards with images, included service/take-home products, branch, dates, fixed price and booking links. Internal supply names, quantities, references and inventory details are excluded from public projections. Public requests now progress one screen at a time: Services or promo → Date → Time → Details → Review. Selections survive calendar navigation; contact drafts use optional tab-local storage with a 30-minute expiry and are cleared on submission (restored after a rejected submission). Changing branch clears promo selection. Selecting a promo replaces the service price instead of charging it twice.

Append-only `0106_public_promo_booking.sql` adds promo image/publication fields and an image-aware idempotent save RPC, shared private offer validation, a safe public catalog projection, RLS-protected immutable request snapshots, and an atomic public submission adapter. It reuses canonical public rate limits, duplicate prevention, published-service checks, hours and availability. A confirmation trigger carries the requested price/inclusions through the existing salon, automotive and pet confirmation functions. Token-protected status exposes requested promo details without private supplies. Existing internal booking now uses the same private offer validator. No production migration, deployment, RLS disabling, or service-role application path was introduced.

Files affected: commerce catalog form/actions/schema, public storefront and token status page, booking selection/form/page/actions, reusable public promo cards/progress, shared promo selection helpers, migration 0106, and focused unit/SQL/browser regressions. Existing browser journeys were updated to follow the wizard. Self-review found a browser behavior where changing Continue to Submit could trigger submission before review; separate button identities and prevented default handling fixed it, and the regression requires zero requests before explicit final submission.

Verification: 481 unit tests passed. The local rollback-only SQL run passed its first 37 assertions, including anon/tenant/branch isolation, internal supply privacy, stale/expired/private offers, correct totals, catalog-change preservation, image persistence/URL constraints/idempotency, and pet confirmation retry. Five further automotive/staff regression assertions were added afterward; permission to rerun was declined, so those additional assertions are not claimed as passing. Schema and fixtures from executed runs were rolled back. Ten catalog/image browser cases passed on desktop and mobile-320; all four final wizard cases passed on those viewports after the premature-submit fix. Browser tests use mocked boundaries; they do not claim a hosted end-to-end deployment test. Final `npm run typecheck`, `npm run lint`, `npm run build -- --webpack`, and `git diff --check` passed.

Deployment: review and apply migrations through 0106 in order; do not rerun 0103 on an installation where it is already present. None were applied to the configured hosted project. Set a promo Active, enable “Show on public website,” publish its service, and enable branch online bookings. Then preview the public card and complete a request through the five steps. Booking creates no stock reservation or physical movement; the previously deferred fulfillment, walk-in, maintenance, job-invoice and hospitality transaction integrations remain outside this update.

---

Historical appointment integration report follows; the current update above supersedes its public-booking limitations.

# Appointment promo booking update

Scheduled appointment creation now offers active branch promos within the service section for salon, automotive, and pet care. Selecting a promo replaces its ordinary service selection. New migration `0105_appointment_promos.sql` adds an atomic booking RPC, immutable accepted offer snapshots, version/date/branch validation, private idempotency receipts, scoped reads, and protected appointment service pricing. Existing appointment totals and payment calculations consume that price. Included product names, native quantities and units appear on appointment details. Catalog edits cannot rewrite accepted terms; editing preserves the promo service and booking identity.

This is appointment booking integration only. Stock is not reserved or deducted by booking; actual consumption/handover still requires Inventory operations. Walk-ins, maintenance reminder booking, public booking, job estimates/invoice integration, and hospitality stays do not gain promo selection. These are still outside this update. The full cross-vertical commerce specification below remains incomplete.

Validation commands completed successfully: `npm run lint`, `npm run typecheck`, `node --import tsx --test tests/*.test.ts` (477 tests), and `npm run build -- --webpack`. Targeted appointment persistence, promo, and scheduling tests were rerun after self-review. `git diff --check` is clean. Added unit, database, and browser regression files; browser/database limitations follow.

Migration 0105 has **not been applied to the configured/hosted database**. A local QA transaction loaded 0103–0105 and passed its first 13 booking assertions (fixed price, duration, quantities, retry behavior, stale version rejection, protected snapshots and price normalization). It stopped on a fixture update affecting unrelated rows; the fixture was narrowed and its setup role corrected. Permission to rerun was declined, so the complete corrected SQL suite remains unverified. The failed session rolled back its schema and data changes. Desktop/mobile browser fixtures compiled but Chrome launch was blocked by the sandbox; permission to launch outside the sandbox was declined. No browser success is claimed.

Apply migrations through 0105 only after reviewing/testing the corrected SQL suite. Manual check: create an active service promo with a branch/date range, open a new scheduled appointment, choose that branch and date, select the promo under Services, and confirm the detail total and included items. Changing the catalog price must leave the existing booking unchanged. Do not treat this as validated stock fulfillment or automotive invoice integration.

---

The following is the historical catalog-foundation report; validation and scope statements above supersede it for appointment booking.

# Cross vertical commerce partial implementation report

The complete requested commerce workflow is **not implemented**. This change delivers shared product and promo-definition management, exact-quantity primitives, and a proposed catalog migration. It does not deliver accepted offers, product charges, transaction fulfillment, or commerce reporting. Do not deploy this as a completed commerce release.

## Execution and reuse

One Developer Agent performed discovery, implementation and review under AGENTS.md; there was no independent QA agent. The source-of-truth matrix and implementation sequence are in `commerce-plan.md`. The writing skill was used only for repository documentation, not to publish external Pages.

Product identities remain in `inventory_items`. Physical stock remains in `inventory_movements`, allocated stock in `inventory_reservations`, services and duration in existing service snapshots, and payment records in `payments`. No competing sale, invoice, stock balance or payment ledger was added. No existing Salon promo implementation was found.

## Implemented catalog scope

- `/dashboard/products` and `/dashboard/promos` are exposed through the existing Business navigation and inventory-management permissions for Automotive, Salon, Pet Care and Hospitality.
- Products reuse branch-specific stock identities, names, descriptions, SKU/category, native units, active status and selling prices. New metadata distinguishes retail/internal/both and stock-tracked/non-stock products. Product forms expose no stock balance edit or cost fields.
- Fixed-price definitions support one service or accommodation component plus product/internal-supply components, branch scope, date fields, status and optimistic version checks. Nested promos, implicit unit conversions and multiple billable services are rejected.
- Accommodation is a context marker, not a fake room product or Salon service.
- Native quantity arithmetic uses bigint thousandths and documented positive half-up rounding to minor units. These primitives are not yet wired to customer charges.
- Forms use existing dialogs, explicit controls, stable IDs, desktop tables/mobile cards, retained drafts after rejected saves, and search/pagination. Unavailable historical component references remain selectable for archival. The Promos page explicitly states that transaction application is not available.

## Proposed migration and security review

`0103_commerce_catalog.sql` is append-only and **has not been applied or executed**. It adds product metadata, `commerce_promos`, private mutation receipts, scoped owner/manager save RPCs, validation/audit triggers and RLS.

Definition validation checks tenant/branch product references, supported industry, currency, active components, exact native units, component purpose, dates and quantity precision. Mutation receipts bind request keys to operation and complete payload; exact retries return the original result and changed retries are rejected. Catalog saves create no stock movements. Existing stock history prevents silent changes to stock identity/unit/tracking; non-stock products reject physical movements. These SQL protections are reviewed code, not verified database results.

No RLS controls were disabled. No service-role application path, production migration, backfill, data rewrite, customer communication, provider charge or deployment was performed. Existing subscriptions and commercial prices were not modified. Existing Inventory plan behavior was reused; no new entitlement grants were added.

## Unimplemented transaction scope

| Requested capability | Actual result |
| --- | --- |
| Date/branch eligibility at acceptance | Definition fields/checks only; no acceptance validator attached to a transaction |
| Immutable accepted snapshots | Not implemented; definition versioning is not an accepted snapshot |
| One canonical promo charge | Existing charge sources mapped; no promo charge integration |
| Accepted add-on product sales | Not implemented |
| Reservation and fulfillment | Existing Core Inventory inspected; no new transaction adapters or triggers |
| Cancellation and unused reservation release | Not implemented for commerce |
| Partial handover, physical returns, refunds | Not implemented for commerce; existing finance behavior unchanged |
| Payments, allocations and reports | Existing capabilities unchanged; no promo/product reporting extension |
| Automotive conversion and authorization | Existing estimate/parts workflow unchanged; no snapshot transfer or double-consumption verification |
| Hospitality accommodation replacement | Existing stay invoice unchanged; no promo application or duplicate-room-charge test |
| Staff attribution and optional contacts | Existing Staff behavior unchanged; no commerce attribution added |

Salon still owns its service lifecycle, Automotive estimate authorization and parts execution, Pet Care grooming/pickup, and Hospitality occupancy/check-in/out. None of those lifecycle boundaries is changed in this partial implementation. There are **no new actual-use/handover stock triggers for any vertical**.

## Four vertical result matrix

| Vertical | Products and promo definitions | Requested complete transaction flow | Classification |
| --- | --- | --- | --- |
| Salon | Implemented, DB/browser unverified | Not implemented | BLOCKED |
| Automotive | Implemented, DB/browser unverified | Not implemented | BLOCKED |
| Pet Care | Implemented, DB/browser unverified | Not implemented | BLOCKED |
| Apartelle/Inn | Implemented, DB/browser unverified | Not implemented | BLOCKED |

Catalog UI alone qualifies as IMPLEMENTED BUT NOT FULLY VERIFIED; it does not qualify any vertical's end-to-end workflow as implemented. The missing transaction work is an implementation gap, not merely a validation gap.

## Validation evidence and defects

Executed with the configured Node 24 runtime:

- `node --import tsx --test tests/*.test.ts`: **469 passed**. Includes five new commerce tests, existing scheduling, inventory, payments, reports and vertical domain regressions. This is not a database or four-vertical end-to-end pass.
- `npm run lint`: passed.
- `npm run typecheck`: passed after fixing the browser test submission-array type.
- `npm run build -- --webpack`: passed.
- `git diff --check`: passed.
- `renderFormFixture("e2e/fixtures/commerce-catalog.tsx")`: JavaScript and Tailwind fixture compilation passed.
- `npm run test:e2e -- e2e/commerce-catalog.spec.ts --project=desktop-chromium --project=mobile-375 --project=mobile-390 --workers=1`: nine tests could not launch Chrome in the sandbox. Outside-sandbox execution was requested and declined. No browser assertion pass is claimed.
- `supabase/tests/commerce_catalog.sql`: written, **not run**. Covers non-privileged tenant reads/writes, mutation retry conflict, native-unit/precision rejection, no stock on promo creation, immutable historical units and non-stock movement rejection. Required last-unit races and transaction tests are not implemented or run.

Review fixed two navigation regression expectations for the new catalog links, uncontrolled form reset after rejected saves, unavailable component references blocking archival, missing catalog request receipts, non-stock movement guards and missing product audit events. Review cannot establish SQL correctness without executing the migration and tests.

## Infrastructure and approval blockers

The local Colima runtime initially started then stopped. A persistent validation session allowed local containers to become visible; its memory setting was reduced from 8 GB to 4 GB during diagnosis. A read of the disposable `supabase_db_negosu-full-qa` migration version via `docker exec` required approval and was **declined by the user**. No SQL was applied. Chrome execution approval was separately declined after the sandbox launch failed. These were user-declined tool requests, not reported automatic-review policy rejections.

Host free disk fell below 400 MB. Only generated `.next/dev/cache` was cleared to permit the build; source files, databases and customer data were not deleted. PrivateResortPH was not modified. The remaining major blocker is an allowed disposable database environment for migration, RLS and transactional development/validation, followed by completing the missing integrations. No safe production-ready verdict is possible.

## Local catalog demonstration steps

Prerequisites: use a disposable Supabase project with repository migrations through 0102, review/apply 0103 **only there**, run `commerce_catalog.sql`, and configure the app explicitly for that local project. The current `.env.local` must not be assumed disposable. These prerequisites have not been executed for this change.

For each test workspace, sign in as its owner or manager, choose a branch, and open `/dashboard/products`. Create an active product with its actual native unit and selling price; confirm creation does not change Inventory stock. Open `/dashboard/promos`, add one billable component and product components, set a fixed price and save. Reopen and archive the definition. Review both mobile and desktop layouts.

| Workspace | Example definition to review |
| --- | --- |
| Salon | Existing facial service plus a take-home cleanser product |
| Automotive | Existing oil-change labor plus native-unit oil and filter components |
| Pet Care | Existing grooming service plus take-home shampoo |
| Apartelle/Inn | Agreed accommodation component plus welcome-kit products |

These demonstrate catalog authoring only. There are no valid local demonstration steps yet for accepting a promo, charging an add-on, handover/consumption, automatic stock posting or corresponding payment/report reconciliation. Complete and verify those integrations before claiming the user's success criterion.
