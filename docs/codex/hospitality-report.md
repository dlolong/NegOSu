# Apartelle & Inn implementation report

> Historical implementation record. The later standard-availability update supersedes the invitation requirement; see `docs/HOSPITALITY.md` and migration 0090.

## Implementation and execution mode

**IMPLEMENTED:** controlled NegOSu Apartelle & Inn pilot, from invited business creation through room setup, guests, check-in, charges, collections, checkout, supplies and reporting. Executed by one Developer Agent with a distinct self-review and actual local validation; no independent QA agent was used. This is reviewable implementation work, not a general-launch recommendation.

Primary navigation: Overview, Rooms, Guests, Payments, Inventory, Reports, Staff. Existing settings provide Branches, Business Settings, access/member administration and **Billing & Plan**. Role filtering applies. Operational users land on Rooms; owners can use Overview. Guest collections and the business's NegOSu subscription remain separate.

## Core reuse and files changed

| Classification | Implementation / principal files |
| --- | --- |
| REUSE EXISTING CORE | Customers as Guests, Staff, branches, access, inventory ledger, payment methods/reversals, report filter/CSV utilities, Command Center, audit, notifications and subscription catalog. Existing dashboard routes compose Hospitality where appropriate. |
| CONFIGURE EXISTING CORE | `modules/platform/{industry,navigation,plan-catalog}.ts`, `lib/auth/context.ts`, role descriptions, shared Staff/Customer labels, settings and dashboard navigation. Trusted activation is checked server-side. |
| NEW HOSPITALITY DOMAIN | `modules/hospitality/`, `components/hospitality/`, `app/dashboard/hospitality/`, `app/onboarding/hospitality/`, `app/apartelle-inn/`. Room/stay transactions, bill associations, front-desk presentation and report projections. |
| SMALL SHARED EXTRACTION REQUIRED | Neutral manual invoices and retry-safe collection primitive in 0086; trusted financial-report policy in 0088. Core does not import Hospitality. Shared Command Center gains neutral profile activation and branch-timezone presentation. |
| TESTS / DOCUMENTATION | `tests/hospitality.test.ts`, `scripts/{hospitality-seed,test-hospitality}.ts`, `e2e/hospitality.spec.ts`; existing platform tests and one SQL fixture were updated. `docs/HOSPITALITY.md` and architecture/industry/roles/deployment documents describe the new boundary. |

No fake appointments or Automotive jobs are created for stays. Core customer/storage symbols remain unchanged. Public copy describes implemented pilot capabilities and does not offer general signup or future reservations.

## Model, business rules and security

Rooms have tenant/branch ownership, unique branch-local names, capacity and active state. Occupancy derives from stays; vacant does not imply cleaned. A room lock plus a partial unique index permits only one active stay, independently of occupant capacity. Occupied rooms cannot be disabled or reduced below their occupants. Check-in uses server timestamps and a stable request key; an initial agreed charge commits atomically. Checkout is retry-safe and preserves its original timestamp.

One lead guest may have multiple rooms. Guest/room names are snapshotted, so later edits do not rewrite stay or bill history. Name is required; supplied contact details are validated, while absent contacts/login remain optional for Guests and Staff.

Hospitality links stays to neutral Core invoices. Exact centavo calculations, locked invoice updates, currency validation and request-key constraints protect manual charges and payments. Unpriced and confirmed zero-charge stays are distinct. Partial/full collections use the existing methods; supported full-entry void/refund operations reopen balances. Recording a payment does not initiate an external transaction.

Checkout ends occupancy only. Debt requires explicit acknowledgment and remains visible/collectible after departure. Financial acknowledgment is stored with the finance-protected bill association. Operational viewers receive no financial report/overview payload. Existing other-industry report-viewer behavior is preserved by a trusted, organization-specific policy.

Security review covered authenticated RPCs, fixed search paths, internal function grants, server-resolved workspace context, composite tenant/branch foreign keys, branch RLS, unauthorized raw reads, anonymous access and export authorization. Invoice-item reads now also require branch access. No privileged browser client or credentials were introduced. Existing subscriptions/prices/provider configuration were not changed.

## Shared operations, reports and UI

Inventory reuses Core products, units, stock, movements, adjustments/receipts, low-stock thresholds and existing transfers. Guest charges **do not deduct stock**; inventory use is recorded separately. Staff Profiles remain distinct from users; job-function suggestions do not create global authorization roles. Existing Core permissions govern staff administration, access management, inventory and Billing & Plan. Hospitality finance reads use owner/manager/advisor/cashier; financial mutations use owner/manager/cashier. See the complete role matrix in `docs/HOSPITALITY.md`.

Collections are paid ledger entries in the selected payment-date period, excluding voided/refunded entries under existing semantics; they are not profit. Outstanding includes checked-out debt and is a current snapshot. Room status, in-house guests and stock are current snapshots; check-in/out and stock movements are period activity. Branch timezones define date boundaries. Totals cover all authorized records, independent of the visible 50-row page. CSV uses the same scope and permissions, formula-safe escaping and one database snapshot; unnecessary guest contact data is excluded.

Free reports retain one accessible branch and the last 30 local calendar days with no CSV. Paid reports support permitted branches, bounded selected dates and CSV. Guest-ledger access does not depend on advanced report export entitlement. Existing notification infrastructure is reused; no guest messaging worker was added.

Responsive tables, compact report tabs/filters, searchable guest selection, dialog actions, pending submissions, semantic IDs, scroll locking, focus handling, stay back-navigation and authenticated printable statements are implemented. Financial summaries are rendered only for authorized users.

## Database work actually executed

Four append-only migrations were added:

1. `0086_core_manual_invoices.sql` — neutral bill support, request keys, exact shared collection primitive, branch restriction and compatible Automotive wrapper.
2. `0087_hospitality_pilot.sql` — trusted invitations/activation, real organization creation, rooms/stays/bill associations, transaction RPCs, RLS and guest-room summaries.
3. `0088_report_financial_policy.sql` — trusted organization-specific financial-report restriction; existing businesses retain their baseline policy.
4. `0089_hospitality_reporting.sql` — scoped, bounded projections and consistent CSV aggregation.

Applied only to local disposable Supabase. Migrations 0073–0089 were also replayed transactionally against a restored local baseline in a separate validation database. Subsequent branch-label/timezone projection edits were applied to the local database and all six report sections were exercised. Existing SQL test suites ran in rollback transactions. Guarded seed/integration/browser scripts performed synthetic local mutations only.

**NOT EXECUTED:** hosted migrations, production backfills/data changes, deployment, pilot invitations on hosted systems, live subscriptions/charges, real customer communications or any PrivateResortPH changes.

## Validation evidence

Commands used Node 24 and a local-environment wrapper, never the hosted database settings. The wrapper supplies the same local environment described in the setup guide.

| Executed validation | Result |
| --- | --- |
| `npm test` | 392 passed, zero failures. |
| `npm run check` (`lint`, `typecheck`, `build`) | All three completed successfully. |
| `node --import tsx scripts/test-hospitality.ts` | 53 integration checks passed, including real concurrent requests. |
| 13 existing SQL suites through local `psql -v ON_ERROR_STOP=1` | 462 assertions passed; inspected for pgTAP failures as well as process errors. |
| Hospitality Playwright: desktop Chromium, mobile 375 and mobile 390, one worker | 8 passed; 4 deliberate skips are mobile duplicates of desktop workspace-switch/setup scenarios. |
| Automotive/Salon authenticated release browser smoke | 2 passed. |
| `git diff --check` | Clean. |

The 53 integration checks include concurrent same-room check-in, atomic failed initial charges, overpayment races, exact duplicate payment retries, malformed/conflicting inputs, zero/unpriced states, unpaid checkout, historical snapshots, raw cross-tenant associations, branch restriction, anonymous/viewer denial, Core stock adjustment, full-scope totals beyond 50 rows, branch-local midnight and direct CSV entitlement checks. Run mutation suites sequentially because they share the synthetic fixture organization.

SQL regression suites and passing assertion counts:

| Suite | Assertions |
| --- | ---: |
| `phase05_06_jobs_finance_rls` | 53 |
| `salon_vertical_foundation` | 74 |
| `salon_appointment_vehicle_optional` | 10 |
| `shared_appointment_reporting` | 16 |
| `phase07_08_inventory_retention_rls` | 43 |
| `parts_reservation_consumption` | 54 |
| `staff_profile_login_decoupling` | 54 |
| `phase12_billing_entitlements` | 22 |
| `reports_every_plan` | 49 |
| `report_dependencies_repair` | 16 |
| `command_center` | 16 |
| `platform_product_entry` | 12 |
| `pet_care_release` | 43 |

Automotive regression executes existing partial/full collection and reversal RPCs. Salon regression executes appointment payment, exact retry, conflicting key rejection, overpayment prevention and invoice-less reversal. Browser smoke separately opens the existing Automotive and Salon critical workflows.

Hospitality browser coverage actually runs at 1366×768, 375×812 and 390×844: optional-contact Guest/Staff creation, room creation, check-in, charges, partial payment, unpaid checkout, later balance collection, print CSS, inventory/reports navigation, dialog focus/scroll/cancel, page overflow, financial denial, organization switching and invited setup. Screenshots of rooms/reports were reviewed. These are Chromium mobile emulations; Safari, physical devices and physical printer output were **NOT EXECUTED**.

Local evidence logs: `/private/tmp/hospitality-validated-check.log`, `/private/tmp/hospitality-unit-final.log`, `/private/tmp/hospitality-final-integration.log`, `/private/tmp/hospitality-latest-browser.log`, `/private/tmp/hospitality-regression-browser.log`, and `/private/tmp/negosu-hospitality-validation/` SQL logs/screenshots. These temporary files contain synthetic local validation evidence and are not deployment artifacts.

## Self-review findings, limits and next step

**FIXED during self-review:** branch-scoped invoice item reads; legacy report financial-access bypass for Hospitality viewers; export consistency while paging; full-dataset totals; per-branch dates/labels; neutral Staff status; stay/statement back-navigation; mobile Check in button wrapping; legacy Automotive error compatibility. The Automotive SQL fixture was scoped to its own organization instead of selecting every invoice in a seeded database.

**BLOCKED:** no known local blocking implementation defect remains. Hosted activation is intentionally not performed, rather than represented as completed deployment.

**DEFERRED:** future reservations, online guest checkout, channel integrations, automatic room rates, refundable deposits, unsupported discounts/charge editing, automatic stock consumption, housekeeping tasks, payroll, identity documents, profit/accounting and new notification/payment infrastructure. Statements explicitly reject more than 1,000 lines/payments; exports reject more than 10,000 rows and require narrower filters. These limits avoid silent truncation.

Exact local URLs, guarded seed commands, accounts and browser commands are in [the Hospitality setup guide](../HOSPITALITY.md#reproducible-local-setup). Login at `http://127.0.0.1:3105/login` after starting the local server; choose **QA Apartelle & Inn** using the documented owner persona. Local fixtures remain available for review. Review the migrations and repeat the controlled-pilot matrix in an approved staging environment before hosted pilot activation.


## Follow-up: homepage and account entry

**IMPLEMENTED:** Apartelle & Inn now appears in the homepage hero, solution cards, overview, FAQ and desktop/mobile/footer navigation. Generic signup/login pages expose pilot access; the dedicated signup route explains invitations and links to branded login/setup. Login errors and password recovery retain product context. Explicit pilot setup links reach the existing invitation gate after authentication, including accounts without a workspace. Other industry signup remains unchanged. No new database/RLS changes or hosted actions were needed for this follow-up.

Files: homepage and authentication routes under `app/`, `app/auth/actions.ts`, `app/apartelle-inn/page.tsx`, shared auth/marketing components, new `components/hospitality-access-notice.tsx`, and platform brand/product-entry configuration. Tests cover the distinction between marketing/auth presentation and permitted public signup, responsive discovery, navigation, sign-in errors and setup redirects. Self-review confirmed that displaying the pilot cannot grant organization access or enable unrestricted signup.

**TESTED:** `npm test` — 393 passed; `npm run check` — lint/typecheck/build passed. New `e2e/hospitality-entry.spec.ts` — 4 passed, 2 deliberate mobile duplicates skipped at desktop, 375px and 390px. Existing `e2e/pet-care-marketing.spec.ts` — 9 passed across 320–1440px, including Automotive/Salon/Pet Care pages, signup and Plans. Reviewed desktop hero and mobile signup/login screenshots. Marketing navigation switches to the compact menu below 1280px to accommodate the new entry. Final diff whitespace check passed. Physical devices, real email delivery and hosted deployment were not executed.
