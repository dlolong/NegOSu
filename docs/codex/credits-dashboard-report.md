# Credits, entitlements and dashboard — Developer Report

## Executive Summary

Premium access is controlled by the effective plan independently of credits. The previously approved 100 one-time credits remain one-time: each existing account's exact remaining balance becomes its ledger opening balance; missing accounts start at 100. Nothing converts this balance into a recurring grant. No new production operation costs or monthly allowances are configured.

Account → Plan, billing & usage provides the business balance, progress, history and plans. Owner notices use the existing notification bell. The shared dashboard displays operational priorities and compact metrics across Automotive, Salon, Pet Care, and Apartelle & Inn.

## Execution Mode

One Developer Agent performed discovery, implementation, security review, tests and fixes. No sub-agents were used, in accordance with the current AGENTS.md and user instructions.

## Architecture

Organization → Subscription → Plan → Entitlements → Configured Credit Allowance → Credit Ledger.

User → Permission → Entitlement → Credit Check (only for configured metered operations) → Operation.

`plans` remains the catalog, `plan_entitlements` resolves effective subscription access, and `has_entitlement` remains the database feature boundary. The existing account row provides the business-wide lock and exact opening balance; grants, allocations and ledger entries determine subsequent available credits. Browser values never authorize a feature, set prices, or write balances.

The private `reserve_credit_operation` engine reads the central operation registry. Domain adapters must validate their own authorized source before invoking it. The implemented adapter binds an existing, claimed SMS outbox row to its organization, worker, recipient/template/payload, and deterministic delivery key. No additional delivery provider or billing system was introduced.

## Free Experience

Customers, services, staff within existing plan capacity, appointments, jobs, stays, checkout, payments, ordinary searches, dashboard, and recent basic reporting do not spend credits. Public-page themes and styles remain free. Free reports expose Today, Last 7 Days, Last 30 Days, This Month and recent custom dates in the current branch; SQL permits the recent 31-day window so a full calendar month fits. Out-of-window browser filters fall back to the recent range; direct unsupported database requests are denied.

## Paid Entitlements

Advanced reports, extended history, multi-branch analytics, saved-report generation and CSV export require `advanced_reports`. New business-image uploads require `image_uploads` plus configured storage capacity and owner/manager permission. Credits cannot bypass these gates. Paid reports and image uploads consume zero credits because no new metered costs were approved. Downgrades preserve images and existing report snapshots; snapshot reads still recheck the original actor, branch access and financial permissions.

## Credit System

- Grants are separate `one_time`, `plan` and future `purchased` lots. Purchased lots cannot expire automatically.
- Available balance is ledger balance less outstanding reservations. The existing one-time balance is carried forward without reconstructing unproven historical transactions.
- Period grants require both an explicit allowance and a grant policy. Business locking and unique grant keys prevent duplicate grants. The subscription update hook, owner usage reads and existing notification cron can synchronize configured periods.
- Overlapping plan windows cannot grant twice. Mid-period plan/configuration changes do not prorate or top up the existing grant; the next eligible window uses the new allowance. Existing granted credits retain their expiry even after a plan change; entitlements are rechecked independently.
- Reservations consume availability, not final usage. Provider acceptance commits usage atomically with the outbox result. Definite rejection/opt-out/configuration failure releases reservations. An ambiguous provider/network result retains the reservation for reconciliation; retry uses the same delivery identity.
- Private, full-operation refunds restore original allocations once. No public refund endpoint or provider-refund integration is enabled. Expired plan credits refunded after expiry are expired again, never converted into permanent credits.
- Reservation, payload identity, grant, usage, release and refund replay paths are idempotent. Ledger history records grant/usage/release/refund/expiration; adjustments are represented in the schema but no adjustment UI or RPC is exposed.
- Expiring plan credits are allocated first. One-time and purchased balances are retained across period changes. Expired held credits remain reserved until the outcome is settled.

## Credit Cost Registry and Exact Configuration Points

Production metered operations: **none enabled**.

| Configuration | Location | Current production state / later action |
| --- | --- | --- |
| Monthly credits per plan | `public.plans.monthly_credits` | NULL for every plan. Set only an approved integer allowance. |
| Monthly reset/grant behavior | `public.plans.credit_grant_policy` | NULL. Choose `calendar_month_utc` or `subscription_month` only after approval. Both allowance and policy must be set. |
| Operation price | `public.credit_operation_registry.credit_cost` | `sms_notification` has NULL cost and `enabled=false`. Missing, NULL, zero or disabled costs do not consume credits for new operations. |
| Feature requirement | Registry `entitlement` | SMS uses existing `reminders`; permission/source checks remain in the adapter. |
| Billable event | Registry `billable_event` | SMS: `provider_accepted`. Generic engine also permits a future adapter's `operation_committed` boundary. |
| Failure behavior | Registry `failure_policy` and adapter | Current policy releases before definitive acceptance; ambiguous outcomes remain held. |
| Period synchronization | `ensure_credit_period`, `sync_configured_credit_periods`, subscription trigger, existing notification cron | No recurring grant while configuration is NULL. Bounded cron batches skip businesses with a current grant. |
| Future top-ups | `organization_credit_grants.credit_class='purchased'` plus ledger | No purchase flow, checkout product, payment amount or grant RPC is configured. A future verified payment/webhook must grant exactly once using its authoritative payment identity. |

`calendar_month_utc` uses UTC month boundaries. `subscription_month` uses monthly windows anchored at the effective subscription's `current_period_start`, capped at `current_period_end`; an annual subscription can have monthly allowance windows. A missing/expired subscription window grants nothing. Plan lot rollover expires unused balance without changing one-time/purchased lots.

Configure approved commercial values through a reviewed migration or trusted database administration. There are no placeholder production prices. Synthetic values exist only in transactional tests and the disposable-database concurrency script. Existing reservations retain their agreed cost; drain/reconcile in-flight operations before changing an enabled cost or provider. Adding a future operation requires a checked domain adapter, not a new ledger architecture. Exports, images, AI and reports have no configured operation price.

## Account Page

The existing Profile and workspace page links to Plan, billing & usage. Billing is the primary usage destination: effective plan, existing one-time balance/progress, refresh button, paginated usage dialog and plans CTA. Monthly figures and refresh dates render only when a configured period grant actually exists. Usage dates are explicitly UTC. Loading, empty, failure, retry and pagination states are supported. Platform administrators have a guarded, read-only `/admin/usage` view; business owners cannot invoke its service RPC.

## Notifications

Central database policy: EMPTY at zero; CRITICAL at ≤10% (minimum 1); LOW at ≤20% (minimum 2). Without monthly configuration, this applies to the approved 100-credit allowance. With a current monthly grant, the denominator is that allowance plus remaining non-expiring credits, so an exhausted historical one-time grant does not create permanent low status.

Only active organization owners receive billing notices. Unique organization/recipient/period/threshold keys prevent duplicate notices. The existing bell shows durable read state and a current-usage CTA. Older severity/period notices are hidden after recovery. The dashboard warning is compact, dismissible, owner-only and below operational panels. Focus/30-second refresh recovers without logging out. No email or SMS credit-warning delivery is implemented or sent.

## Upgrade Experience

Existing capability notices now open a shared native dialog using the live catalog recommendation. The dialog identifies the included capability and links to plans; non-owners are directed to comparison/owner assistance. Low/zero-credit notices explain that core features remain available and link to current usage and plans. No credit purchase promise is shown while top-ups and recurring commercial allowances remain unconfigured.

## Dashboard Architecture

NegOSu Dashboard → shared CommandCenter presentation → vertical contributor (Automotive / Salon / Pet Care / Apartelle & Inn).

Core does not import vertical services. Branch scope is resolved from authenticated membership and revalidated by the database. Metrics use uncapped aggregates; bounded work lists support quick operational navigation. The dashboard uses one page scrollbar, six compact metrics, needs-attention items, today's operations, quick actions and staff context. Redundant dashboard charts were removed. Missing aggregate migrations fail closed instead of falling back to obsolete financial arithmetic.

## Automotive Dashboard

Appointments today, jobs in progress, estimates awaiting approval, vehicles ready for release, collections today and outstanding invoices. Existing attention items include approvals, queued work, quality checks, release readiness, completed-job balances, maintenance and stock. Scheduled vehicles/jobs and technician context remain linked to operational workflows. Draft/void invoices are excluded from outstanding; automotive appointments are not added again to invoice balances.

## Salon Dashboard

Appointments today, checked in, in service, completed today, collections and outstanding. Existing attention/assignment logic is retained. Work rows show client, treatments, assigned staff/resource and status. Outstanding uses completed appointments less valid payments plus separately invoiced retail checkout, avoiding duplicate base invoices.

## Pet Care Dashboard

Appointments today, checked in, grooming in progress, ready for pickup, collections and outstanding. Pickup/waiting/stock actions precede pet/owner/service/staff work rows. Staff profiles are branch-filtered; they are described as active profiles rather than invented live attendance. Operational staff retain their existing grooming workspace and do not load owner financial payloads. No veterinary records or workflows were added.

## Apartelle Dashboard

Occupied, available, check-ins today, checkouts today, collections and outstanding. Existing canonical hospitality reporting already uses branch-local today. Cleaning, checked-out balances and stock appear in attention. Current stays and today's activity link to stay details; staff profiles are branch-filtered. No future reservation or SLA workflow was invented.

## Role-Aware Dashboard

Owner: operational/financial metrics in authorized branch scope, plus own-business usage and credit notices.

Manager: authorized branch operations and finances; no owner billing balance or credit notices.

Staff: existing operational routes and permitted tasks. Automotive technicians use My Work; hospitality staff use Bookings; salon/shared staff see their branch schedule; pet staff see grooming activity without the owner finance read.

## Security / RLS and Self-Review

Credit tables and registry have RLS enabled and no public/anonymous/authenticated direct access. Owner RPCs, service-only worker RPCs and private helpers have explicit grants. Composite organization keys protect allocation/ledger references. Account locks serialize spending and grants. Existing financial and branch policy remains authoritative. Client requests cannot grant, adjust, refund or choose the billed organization/cost. APIs return controlled errors and use private no-store responses. Provider message bodies/secrets are not exposed in usage history.

Self-review fixed duplicate dashboard invoice/appointment arithmetic, draft balances, branch-unfiltered hospitality staff, recurring warning denominators, an obsolete nested-scroll CSS rule, stale credit-unlock copy, the concurrency fixture cleanup ordering, and branch-specific shortcuts in the all-branch view. No unresolved BLOCKER/HIGH finding remains in the executed local scope.

## Billing / Plans

Public pricing, Billing and effective entitlements read the database plan catalog. Public/Billing credit allowances appear only when both allowance and policy are configured. Existing prices, providers, plan limits and checkout pricing were not changed. Public cards now derive capacity/feature claims from catalog data rather than hardcoded tier claims. No service/provider IDs are added to public catalog output.

## Database

New append-only migrations in this phase:

- `0143_entitlement_credit_separation.sql`: independent premium gates, preserved historical snapshot reads, recent Free report dates, paid-only upload boundary, nullable allowance configuration.
- `0144_organization_credit_ledger.sql`: registry, lots, reservations, allocations, ledger, notices, RLS, indexes, idempotent period engine, worker integration, private refunds, owner/platform reads.
- `0145_dashboard_activity_catalog.sql`: authoritative financial dashboard correction, exact operational counts, safe live public catalog fields.

Prior uncommitted `0141`/`0142` migrations remain intact. Apply the complete sequence through 0145 before deploying this app; do not stop at 0141/0142, whose historical policy allowed credit-based premium access. No destructive production backfill is required. Existing balances initialize lazily as explicitly labeled opening balances.

Local validation cloned schema plus plan/permission seeds into the disposable `negosu_usage_dashboard_0145_20261016` database and applied migrations 0098–0145. Transactional fixtures do not contain production records. Production migration executed: **NO**. Deployment, customer communications and real charges: **NO**.

## Four-Vertical Regression

| Vertical | Executed local result | Scope |
| --- | --- | --- |
| Automotive | PASS | Shared checkout, invoice/report totals, command-center permissions and branch-local collections, notification outbox; dashboard rendering at all six viewports. |
| Salon | PASS | Appointment/client reporting, checkout, paid uploads, independent feature gates, dashboard balances; six viewport layouts. |
| Pet Care | PASS | Pet Care lifecycle and release suites, shared checkout/reporting; six dashboard layouts. |
| Apartelle & Inn | PASS | Hospitality general availability, shared checkout/report compatibility, existing branch-local report boundaries; six dashboard layouts. |

These are the executed regression scopes, not a claim that every workflow in each vertical was exhaustively tested.

## Browser QA

Actual Chrome, synthetic component/API fixtures: **41 passed**. Two pre-existing live-authentication dialog tests were **skipped** because authenticated fixtures were not configured.

All four dashboard styles: **320×740, 375×812, 390×844, 430×932, 1366×768, 1440×900**. Account/notification/upgrade interactions: **375×812, 390×844, 1366×768**. Additional dashboard regression widths: 390/768/1366/2072 with height 976; saved-report/upload widths: 320/768/1440 with height 900. Existing Billing fixture tests also ran.

Executed interactions include branch selection, all-branch operational safeguards, quick-action destinations, warning dismissal/recovery, history open/close/focus/pagination, unavailable-data retry, conditional monthly display, notice read state, upgrade dialog and plans link, saved-report pagination, CSV preparation and network retry identity. Horizontal overflow and single page scrolling were checked. Mobile and desktop screenshots were visually inspected. Browser fixtures do not claim a live authenticated end-to-end session, production data, or actual provider execution.

## Tests and Commands Run

Using Node 24:

```sh
npm run lint
npm run typecheck
node --import tsx --test tests/*.test.ts tests/**/*.test.ts
npm run build
```

Lint and typecheck passed. **621 unit tests passed.** Production build passed. `git diff --check` passed. Generated build-only `next-env.d.ts` path changes were restored.

Local SQL was executed using `docker exec -i supabase_db_negosu-full-qa psql -U supabase_admin -d negosu_usage_dashboard_0145_20261016 -X -v ON_ERROR_STOP=1`, checking TAP output as well as process exit status:

| Suite | Assertions passed |
| --- | ---: |
| trial_credits | 34 |
| organization_credits | 59 |
| notification_outbox | 47 |
| client_purchase_report | 71 |
| shared_appointment_reporting | 16 |
| checkout_product_report | 10 |
| command_center | 20 |
| shared_checkout | 111 |
| pet_care | 58 |
| pet_care_release | 43 |
| hospitality_general_availability | 17 |
| reports_every_plan | 49 |
| plan_image_uploads | 13 |
| platform_admin_management | 18 |
| **Total** | **566** |

Database checks execute actual functions and RLS under authenticated, anonymous and worker roles as applicable. No suite result was inferred from source inspection.

```sh
python3 scripts/test-trial-credit-concurrency.py --local-disposable-database negosu_usage_dashboard_0145_20261016
```

Four checks passed: last-credit competition, concurrent duplicate reservation, one accepted debit/nonnegative balance, and concurrent monthly initialization. Synthetic settings and generated fixtures were restored/removed. Final checks confirmed every monthly allowance/policy remained NULL, operation costs remained NULL/disabled, and no race fixtures remained. The disposable database was dropped and the dedicated validation VM stopped; no hosted environment was changed.

```sh
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/usage-dashboard.spec.ts e2e/trial-credits.spec.ts e2e/command-center-layout.spec.ts e2e/billing.spec.ts e2e/dialog-notifications.spec.ts --project=desktop-chromium --workers=3
```

Result: 41 passed, 2 skipped as described above.

### Security disposition in the executed local scope

| Check | Result | Evidence |
| --- | --- | --- |
| Cross-tenant credit isolation | PASS | Owner usage and notice calls reject the other organization. |
| Self credit grant | PASS | Direct ledger/registry/account writes and private grant/refund calls denied. |
| Entitlement bypass | PASS | Free credit balances do not unlock reports or uploads; direct RPC/Storage boundaries checked. |
| Credit overspend | PASS | Last-credit concurrency race admits one reservation; duplicate acceptance debits once. |
| Financial dashboard permission | PASS | Owner/manager branch checks and staff/foreign-tenant denial in actual SQL. |

### Files and modules changed

- Database migrations/tests: 0143–0145 and credit, dashboard, report-policy regressions; prior 0141/0142 work preserved.
- Credit domain/API: `modules/platform/credits.ts`, `app/api/dashboard/credits`, existing notification outbox/cron and notification route.
- Account/notifications: credit usage/history/warning components, Billing/Settings, notification bell, shared upgrade dialog, Platform Admin usage.
- Dashboard: shared CommandCenter/CSS, automotive/salon adapters, new pet contributor, hospitality overview, core aggregate runtime.
- Catalog/report/upload integration: live public/Billing catalog, recent-report scope, existing saved-report and upload retry flows.
- QA/documentation: unit and browser fixtures, database suites, disposable concurrency script, this report and superseding policy notes.


## Remaining Limitations and Risks

- Real metered SMS is intentionally not activated: only disabled/console development providers exist. Before enabling a real provider, implement provider idempotency and reconciliation for ambiguous acceptance/refunds, configure approved cost, and test its contract. Console delivery never spends credits.
- No top-up checkout, manual balance-adjustment interface, partial refund policy, AI workflow or new export provider was introduced.
- Live Storage byte transfer/retry remains a staging smoke test; local SQL verifies the actual metadata/quota trigger and browser fixtures verify retry identity.
- Browser QA covers rendering and interactions with synthetic data; real login/organization switching/provider integration needs staging validation.
- Work lists are bounded previews, not exhaustive analytics. Older/high-volume items may require their operational page. Financial/metric totals are uncapped database aggregates.
- Historical trial spending remains in the previous operation audit table. The new ledger carries forward the exact remaining amount as an opening balance instead of inventing historical ledger entries.
- Saved report retention/cleanup remains an operational policy decision. No records or uploaded media are automatically removed.

## Recommended Next Phase

Pilot Monetization & Retention Measurement: premium discovery, upgrade attempts, actual metered usage, low-credit frequency, conversion and 30/60/90-day organization retention. Approve allowances/costs based on provider economics and pilot evidence. Avoid additional arbitrary paywalls. Run staging smoke tests, then apply migrations and deploy through the normal reviewed release workflow.

### Hospitality date-filter follow-up (0146)

The Payments default (`This month`) and recent custom periods conflicted with the
legacy 0116 database restriction to exact 1/7/30-day presets. Apply
`0146_hospitality_recent_date_access.sql` after 0145 to align hospitality payments,
stay history, and reports with the inclusive recent 31-day Free allowance. Paid
ranges, finance roles, tenant/branch authorization, and financial queries are
unchanged. Non-finite dates are rejected explicitly. No credit costs are added.

Validation: a disposable local database reproduced nine failures with the old
function, then passed all 33 `hospitality_general_availability.sql` assertions
with 0146. All 10 hospitality date-scope unit tests and targeted ESLint passed;
`git diff --check` passed. No production migration was applied. This SQL-only
fix did not require a new application build or visual changes.

### Notification-only upgrade guidance

Plan upgrade guidance now renders in the dashboard notification bell, with no
inline upgrade boxes, upgrade dialogs, or dashboard credit banners. Existing
feature/limit call sites register a capability with the shared provider; repeated
requests are deduplicated and re-evaluated against current entitlements. These
presentation notices last for the workspace session and reset when switching
organizations/roles or reloading. Credit notices retain their persisted,
owner-only read/unread behavior and current-balance checks. Billing remains the
place to manage plans and inspect balances/history. Disabled-feature explanations
and server-side access enforcement remain intact. No database migration or
commercial configuration changes are required.

Validation: 29 synthetic browser tests passed across mobile/desktop sizes and all
four vertical dashboards; 54 targeted plan/credit/notification unit tests passed.
Lint and TypeScript checks passed. Live authenticated scenarios were updated but
not rerun against a hosted environment.

The production build also passed (`npm run build`). No deployment was performed.

### Free-plan filtered reports and CSV (0147)

This requirement supersedes the earlier plan-only rule **for report generation
and CSV preparation only**. Free-plan users with reporting permission can choose
report type, dates, authorized branches, client/item search and purchase kind on
Reports, then explicitly generate a saved result. The existing approved cost is
1 credit per successful generation or CSV preparation. Plans with advanced
reports continue at zero cost. Editing filters, paging saved results, reopening,
and downloading an already-prepared CSV do not debit credits. The basic summary
remains available without a charge. No upload entitlement or other feature gate
is relaxed.

Apply `0147_credit_funded_reports.sql` after 0146 before using the updated UI.
The production configuration points are `credit_operation_registry` rows
`advanced_report` and `csv_export` (enabled, cost 1, operation_committed).
Monthly allowances and other unapproved costs remain unset. Current request cost
consent is bounded to the approved 0/1 values; increasing prices requires updating
the consent UI/schema too. Unconfigured/disabled operations never debit.

The checked report adapter locks the shared account, reserves ledger credits,
uses private transaction-scoped report access, saves the result, commits the debit,
and clears temporary access in the same transaction. Any failure rolls back the
reservation and result. Saved access still checks actor, current role and branch
access. Low/zero credit messages use owner notifications; exhaustion also registers
plan guidance in the bell. No charges occur on page loads or GET requests.

Validation: 624 unit tests, lint, typecheck and production build passed. SQL
regressions cover one-credit charges, retry, failed generation rollback, zero
balance, unpaid direct-RPC denial, cross-tenant denial, saved report access,
unconfigured costs, and hospitality historical filters/CSV. Two local concurrent
request tests confirmed final-credit protection and exactly-once duplicate billing.
No production SQL, deployment, or commercial payments were executed.

Final 0147 verification: all 150 assertions across the four SQL suites passed on
a clean disposable database; four browser scenarios passed at 320/768/1440px,
including Free-plan generation, CSV, paid retries and image regression coverage.

### Weekly-first Reports layout

Reports now opens on a branch-local **Last 7 days** summary for every plan and
vertical. `loadWeeklyReport` reuses canonical read-only reporting RPCs and never
calls the credit/snapshot adapter. Weekly, Custom report, and Saved reports views
share a workspace with independently scrolling results and right-side filters on
desktop. Mobile uses normal document scrolling. Date edits and view changes do
not submit requests; Apply filters and Prepare CSV explicitly use the existing
0147 adapter and its approved costs. Reopening and paging saved data remain free.
Credit balances, deduction counts and persistent cost banners are removed from
report content. Action tooltips disclose cost; insufficient balance routes plan
guidance to notifications while retaining a neutral failed-action explanation.

No new migration, cost, permission or RLS changes. Existing migration 0147 is
still required for custom report/CSV charging. Validation: 629 unit tests passed,
including all-vertical read-only weekly scope and error-path tests; five browser
scenarios passed, including independent scroll behavior and no POST on weekly
navigation/filter edits. Lint, typecheck and production build passed. Desktop
fixture layout inspected; no hosted-environment deployment performed.

### Report usability refinement

Report actions stay visible while the filter panel scrolls. Date shortcuts (last
7 days, this month, last month) and Reset only edit the form; they never generate
or charge. Optional client/item fields are grouped under More filters. Saved
reports have one entry point with readable names, and results identify their date
range and branch. Mobile Custom report navigation focuses the filters and a
completed generation returns focus to results. Weekly defaults, credit charging,
notifications and server security remain unchanged.

Validation: six local browser scenarios passed, including date/reset no-charge
checks and pinned-action visibility, plus lint, typecheck and production build.
Desktop fixture inspected. No migration or production deployment required.

### Table-first category tabs

Reports defaults to the Daily table (recent seven days), with Bookings, Payments,
Products, Clients, Services, Staff and Saved tabs. The permanent sidebar and
summary cards are removed from the default view. The existing icon-only
FilterPopover keeps filters hidden until opened and closes after successful
preparation. Category changes never generate a paid report.

Bookings and Payments show up to 50 recent branch records, with exact counts and
links to full registers. Product sales reuse the canonical all-time handover RPC
and explicitly label that scope. Detailed client/service/staff tables use explicit
filter generation under existing credit rules. Paid reports remain unmetered.
New read adapters retain RLS, explicit organization/branch predicates, local date
boundaries and finance-role checks; no migration or entitlement change.

Validation: 632 unit tests, five browser scenarios, lint and production build
(including TypeScript) passed. Category tests verify tenant/branch predicates,
query bounds and restricted finance roles. Browser tests cover hidden popup,
Escape close, category navigation without POST, retry and CSV flows at
320/768/1440px. Hosted data queries were not exercised; no deployment performed.

### Automatic seven-day category tables (supersedes Daily/Saved tabs)

Reports now opens on Bookings. Removed Daily and Saved navigation and the saved-history fetch dependency. All six remaining tabs load the active branch's last seven local calendar days without opening filters or generating a snapshot. Filters remain an icon-triggered popup; explicit custom report/CSV preparation keeps existing credit behavior. No balance banner was added.

Products, Services and Staff show purchases/operational attribution by client using canonical purchase data, rather than all-time product totals. These default tables show the first 50 matching clients and the total count; Bookings/Payments retain their full-register links. Custom reports retain pagination. `0148_recent_purchase_tables.sql` must be applied before deploying the new readers. It exposes only a fixed branch-local seven-day window with paging, preserves reporting/financial/branch checks and uses the private transaction context without ledger mutations or snapshot creation. Historical migrations are unchanged. Saved snapshots remain in the backend for CSV/retry compatibility.

Self-review: no client-supplied dates enter the default purchase RPC; no cross-tenant or unassigned-branch access, financial-role bypass, or persistent advanced entitlement was introduced. Default records use the existing canonical appointment/invoice totals and staff attribution. Live hosted data was not accessed.

Validation: 636 unit tests, 5 browser fixture tests (320/768/1440 widths plus navigation and retry coverage), lint, typecheck and production build passed. Disposable-database regression tests cover existing credit charges plus free defaults at zero balance, old-date exclusion, context cleanup, invalid kinds, foreign/unassigned branches and financial roles. No production migration or deployment was performed.

### Salon appointment details and simpler filters

Salon Bookings now shows appointment time, client, staff, products availed, total amount and status in both the default seven-day view and newly generated custom reports. Staff attribution uses the canonical participation view. Appointment totals add posted checkout product bills once; fulfilled promo inclusions are labelled and do not add a second charge. Unposted/removed products are excluded. Payment tables show full-period Total sales and Revenue collected using existing canonical summary amounts, with date/status semantics stated beside the figures. These are sales and cash collection measures, not profit.

The filter popup now contains dates and branch plus quick date choices. The active tab determines report kind, purchase kind and hospitality section, removing redundant report/section/type selectors and extra client/item fields. Default-table search remains available. Salon custom appointment/payment results retain their detail table rather than switching to daily aggregates; CSV snapshots include the detail sections.

Apply `0149_salon_report_details.sql` after 0148 before deploying this UI. It wraps the canonical appointment summary reader, preserves its financial/tenant/branch/plan checks, revokes direct access to the renamed internal reader, and adds salon-only detail arrays. No RLS policies or credit prices changed. Default tables remain limited to 50 visible rows; custom results paginate. Previously saved snapshots remain readable with their original fields.

Self-review and validation: 640 unit tests, 81 client/purchase SQL assertions and 32 credit/default-access assertions, 6 browser tests including mobile salon tables and simplified filters, lint, typecheck and production build passed. Tests cover multiple/inactive staff, posted product totals, promo inclusion, branch scope, payment-vs-sales totals, free defaults, retry and CSV behavior. Live hosted data and production migration application were not performed.

### Collapsible toolbar search

Reports now has a search icon immediately beside Filters. Clicking it opens and focuses a text field; Escape or the close button clears and collapses it, restoring focus to the icon. Switching categories or receiving a new report clears the query. The shared table search matcher filters currently loaded rows in default and custom tables through an opt-in context; other pages retain their existing table controls. The duplicate inline report search controls were removed. Search does not send requests, spend credits or alter totals/CSV contents. Default tables remain limited to their loaded 50 rows; search does not fetch unloaded pages.

Validation: 640 unit tests, 8 report browser tests, lint, typecheck through the production build, and production build passed. Search-specific checks cover 320px/1440px layouts, initial icon state, focus, matching/empty results, Escape/close, tab reset and zero charge requests. No schema, authorization, RLS, or credit rules changed; no migration is required.

### Shared professional tabs and catalog-style Reports layout

Route tabs and in-page report selectors now share one underline style, active tint, spacing, count badges, focus treatment and horizontal overflow behavior. Existing ListTabs consumers inherit the style across dashboard lists/settings. Pet record tabs, platform admin navigation and job section navigation now reuse Tabs rather than maintaining separate styles. Route destinations, query parameters, section anchors and IDs are preserved. Public marketing navigation is outside this dashboard tab change.

Reports now uses the catalog's max-width container and layout order: header, full-width tab strip, right-aligned search/filter toolbar, then scope/summary/table content. This preserves the seven-day defaults, collapsible search, filter popup, CSV preparation and credit rules. The table remains the main content; tabs do not wrap into multiple button rows on phones.

Self-review found and fixed an inherited button-font rule that initially made report selectors larger than route links. Browser tests compare actual computed styles at 320px and 1440px, exercise keyboard selection and route links, and verify report toolbar ordering and no page overflow. Validation passed: 640 unit tests, 12 browser fixture tests, lint, typecheck and production build. No database migration, RLS/authorization or pricing changes; no deployment performed.

### Automotive and pet-care booking details

The shared booking table now covers salon, pet care and automotive for default seven-day reads, generated date-range reports and CSV snapshots. `booking-tables.ts` replaces the salon-specific mapping. Columns use Customer / Technicians / Products purchased / Total billed for automotive, Pet owner / Grooming staff / Products availed / Total amount for pet care, and existing salon labels. The default limits, search, filters and credit rules are unchanged.

Apply append-only migration `0150_vertical_booking_reports.sql` after 0149. It adds an internal, scope-checked detail reader and extends canonical appointment and owner reports with `bookingDetails`; salon retains `salonDetails` for backward compatibility. Automotive follows linked jobs and source-invoice checkouts, uses posted invoice totals rather than appointment estimates, and deduplicates invoice and staff attribution. Unbilled bookings show zero with explanatory text. Pet care retains appointment service totals plus posted product bills, with fulfilled promo products included without another charge. This tab contains dated bookings; standalone jobs without a linked booking remain in job reports. No RLS or credit-pricing changes.

Validation: 642 unit tests, 94 purchase/report SQL checks plus 32 credit/default-access checks, 10 browser tests, lint, typecheck and production build passed. Coverage includes linked automotive retail, staff deduplication, canonical totals, private-helper denial, foreign-branch denial, vertical column/CSV labels, mobile layout and unchanged salon behavior. No hosted data was accessed and no production migration or deployment was performed.

### Promos, Rooms and financial cards

Promos is available across verticals; Apartelle/Inn also has Rooms. Both default and custom reports show current promo prices or room package rates, monetary totals and revenue. Every monetary category now shows Total amount / Total revenue cards above its table. Product, service and staff default tables retain whole matching transaction amounts and paid-to-date values instead of hiding those columns. Custom service/staff reports use client purchase records to keep monetary context. Payment detail tables now also apply to automotive and pet care. Hospitality stay reports expose charges, paid and balance under existing finance-role checks. Mobile tables keep amount columns visible; UI money is formatted in the business currency and CSV numeric amounts remain labelled centavos.

Financial bases are explicit in each report: business summaries use period sales and cash receipts; client/item/staff tables use whole matching transactions and current paid amounts; promos use accepted price allocations (excluding cancellations/no-shows) and completed promo value rather than untraceable cash allocation; Rooms uses stay bills issued in the period and paid-to-date amounts on those bills. Rates/status are current. Separate retail bills are excluded from room-specific totals but included in the overall hospitality totals. Totals cover the full report, not only the first 50 visible rows or local search results. Existing default/CSV/custom-report credit rules are unchanged.

Apply append-only `0151_report_promos_rooms_totals.sql` after 0150. It adds a canonical financial catalog reader, extends the checked credit adapter with catalog snapshots and enriches hospitality financial reports without granting finance data to unauthorized roles. Self-review identified and fixed a possible overview-mode date-range bypass: new historical totals are never returned in overview mode. Old migrations, RLS, tenant scope and branch scope remain intact.

Validation: 645 unit tests; 208 SQL assertions across client purchases (101), multi-service promos (36), credit reports (36), and hospitality access (35); 12 report browser tests; lint, typecheck and production build passed. Checks cover full-scope totals beyond 50 rows, multi-service price allocation, completed/cancelled promos, room bill totals, foreign-branch denial, overview boundaries, one-credit charging, retry and rollback, tab visibility, monetary columns/cards and mobile layout. No hosted data was accessed, no production migration applied, and no deployment performed.
