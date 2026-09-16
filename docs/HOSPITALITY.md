# NegOSu Apartelle & Inn

Implemented by one Developer Agent. This is a small immediate-stay workflow, not a hotel PMS. `hospitality` is the persisted industry key. Public entry: `/apartelle-inn`; standard signup: `/signup?industry=hospitality`.

## Reuse and ownership

| Classification | Implementation |
| --- | --- |
| REUSE EXISTING CORE | Auth, organizations, branch switching, Customers as Guests, Staff profiles and optional contacts/login, role/membership administration, invoice/items/payments and reversals, products/inventory ledger, report date/scope/CSV helpers, Command Center component/contracts, audit events, notification bell/low-stock attention, SaaS subscription catalog and Billing & Plan. |
| CONFIGURE EXISTING CORE | Hospitality capability/navigation configuration, Guest presentation, Staff job-function suggestions and access labels, plan feature copy, application route composition, standard self-service account, business and branch onboarding. |
| NEW HOSPITALITY DOMAIN | Rooms, stays, guest occupancy snapshots, explicit stay-to-invoice association, check-in/out policies, report projections and front-desk screens. |
| SMALL SHARED EXTRACTION REQUIRED | Neutral manual invoices, retry-safe invoice collections, branch restriction on invoice-item reads, configurable financial-report role policy, Command Center timezone/profile-status support, customizable Customer form labels. |
| BLOCKED / NOT IMPLEMENTED | No requested workflow remains blocked in local validation. Hosted rollout is not executed. |
| DEFERRED | Reservations/online booking, calendar/seasonal pricing, deposits, online guest checkout, stock-linked sales, housekeeping assignments/checklists, accounting/profit, channel/door-lock integrations, payroll and identity-document uploads. |

Core domain modules do not import Hospitality. Application routes choose the active industry's screen. Manual invoices do not create jobs, vehicles or appointments.

## Navigation and permissions

Overview → Rooms → Guests → Payments → Inventory → Reports → Staff; Settings contains Business/Profile, Branches, Staff/Access, Billing & Plan. Resources, public booking and service-management links are excluded. Front-desk and other non-manager users land on Rooms. Owners/managers use the existing Command Center.

| Existing access role | Hospitality policy |
| --- | --- |
| Owner | Rooms, guests, stays, finance, inventory, reports, Staff/system access, business/branch administration and SaaS billing. |
| Manager | Rooms, guests, stays, finance, inventory, reports and existing business settings; Staff/system-access management remains owner-only under Core permissions. |
| Advisor (Front Desk label) | Manages guest profiles, reads stays and financial details, and can check out. New arrivals require a cashier, manager or owner. |
| Cashier | Selects a vacant room and fixed stay package, receives payment, returns cash change, checks in/out, and records additional charges and existing payment reversals. Cannot edit room rates. |
| Technician (Operations Staff label) | Reads operational room/guest/stay records and marks cleaned rooms ready; no financial or room-rate editing access. Housekeeper remains a staff job function. |
| Viewer | Operational reads and operational reports; no financial ledger/report payloads. |

Receptionist, Caretaker, Housekeeper and Manager are job-function suggestions, not new authorization roles. Staff Profile remains separate from an authenticated User. Shared RLS and assigned access branches apply. Core customer profiles remain organization-wide; occupancy and financial relationships are branch-restricted.

All Hospitality organizations enable the neutral `financial_report_roles_only` policy. This closes access to financial aggregates through legacy Core report RPCs for operational viewers while retaining existing Automotive/Salon report-viewer behavior. Users cannot change that trusted policy directly. Financial queries are skipped entirely for unauthorized Hospitality readers.

Free Reports: one accessible branch, last 30 local calendar days, no CSV export. Paid Reports: selected dates (maximum 731 days), accessible branches and CSV. The database resolves authoritative entitlements. Normal guest-payment history remains available to authorized finance staff independently of advanced report exports. Operational stay history never returns a financial summary.

## Room, stay and financial model

- The Rooms table shows Available, Occupied, Cleaning and Inactive rooms together, with status badges, search and role-appropriate actions. Status is a dedicated desktop column and appears under each room name on mobile. Stay history remains separate. Older status-tab links also open this combined table.
- Rooms have branch-unique names (case-insensitive), optional type/description, occupant capacity and active state. Occupancy derives from stays; there is no editable occupied flag. Available rooms have no active stay and no pending cleaning cycle. Existing room readiness is preserved at migration; each subsequent checkout requires cleaning.
- One active stay per room is enforced by a partial unique index. Check-in locks the physical room; retries serialize by organization/request key. Capacity is checked independently. Occupied rooms cannot be disabled or reduced below their occupants through the write RPC.
- Guest identity is optional. An unnamed arrival stores a Walk-in snapshot and a null customer association, without a fake customer profile. An optional name does not create a profile. Existing linked Core guests remain supported with tenant foreign keys. Guest and room names are snapshotted on check-in.
- Room administration configures positive fixed prices for 3, 6, 12 hours, daily (24 hours), and weekly (7 days). At least one period must be enabled. Only owners/managers edit these rates. Optimistic versions reject stale cashier forms and stale room edits; existing stays retain their rate snapshot. Existing rooms require rate configuration before a new arrival.
- Actual check-in/out times and actors come from the server. New check-in commits occupancy, the selected room charge and full payment atomically. Paid period ends at check-in plus its configured duration; it is informational and never automatically vacates the room. Old unpriced, zero-charge, partial and unpaid stays remain readable and collectible.
- Hospitality owns `hospitality_stay_bills`, including the financial-protected rate snapshot and normalized arrival request for exact retries. Core owns invoice items, exact centavo totals and payments. The original accommodation rate cannot be overridden at arrival. Additional charges remain additive; unsupported charge editing/discount/deposit workflows are not advertised.
- Cash received must cover the configured price. Core records the price as collected revenue and stores tendered cash/change separately with a database arithmetic constraint. Noncash payment is exactly the price. Change is shown before saving, on stay details and the printable statement. A request UUID serializes duplicate arrivals; conflicting payloads fail. Two different arrivals for one vacant room cannot both succeed.
- New collection requests use a stable UUID. The invoice lock and unique request key prevent concurrent overpayment/duplicate recording. The older Automotive payment RPC delegates to the shared primitive and preserves its error contract. Currency is resolved/validated against the business. Collection date must be between bill creation and today in branch time.
- Cash/GCash/Maya/bank/card/other entries record money already received. No external transaction is initiated. Existing full-entry refund/void semantics reopen the invoice balance; an actual refund is arranged separately. No partial refund engine is introduced.
- Checkout ends physical occupancy and sends the room to **Cleaning**, keeping it visible in the combined room table but unavailable for check-in. Outstanding debt needs an explicit acknowledgment and remains collectible afterward. Acknowledgment is held with the finance-protected association, not exposed on operational stay rows. Checkout retries preserve the original timestamp and never restart completed cleaning.
- A Housekeeper with Operations Staff access (or owner/manager/front desk/cashier) uses **Rooms → find the Cleaning room → Mark ready** after cleaning. Completion saves the actor/time. The expected checkout ID and room lock reject stale confirmations from an earlier cleaning cycle. Viewers cannot mutate cleaning status. Inactive rooms remain inactive even if marked clean; reactivation does not bypass pending cleaning. Dashboard, reports and CSV separate Cleaning from Available.
- Guest statements are authenticated, printable ledger summaries. They are not tax invoices, provider receipts or SaaS subscription receipts. Statements are capped at 1,000 lines/payments with an explicit error rather than silent truncation; the stay ledger remains paginated.

## Reports, inventory and notifications

Collections use paid Core ledger entries by payment date/method. Refunded/voided entries remain visible but are excluded from collected totals, following existing reversal semantics. Collections are not profit. Outstanding balances include checked-out stays and ignore the activity date filter. Room status, in-house stays and stock are labeled current snapshots; check-ins, checkouts and stock movements use the selected activity period. Each branch's timezone defines its date boundaries; Command Center today uses each branch's own local date.

Database aggregation covers the full authorized scope, independent of the 50-row detail page. CSV reuses formula-safe escaping and the same report scope/permissions; it excludes contact data and internal identifiers. Exports exceeding 10,000 rows require a narrower filter. A single stable database call assembles all export pages and totals from the same statement snapshot.

Inventory uses existing products, branch stock, movements, receipts/adjustments, low-stock thresholds and transfers. **Stay charges do not deduct stock.** Staff record any stock use separately through Inventory. The existing notification bell and Command Center low-stock conditions are reused; there is no new delivery worker or automated guest messaging. Missing guest/staff contact destinations never block stays or payments.

## Migrations and rollout

Apply append-only migrations 0086–0092 in order after 0085:

1. `0086_core_manual_invoices.sql`: neutral invoices, charge/payment idempotency, invoice-item branch restriction and legacy payment wrapper.
2. `0087_hospitality_pilot.sql`: controlled invitations/organizations, rooms/stays/bill associations, transaction RPCs, RLS and guest room summary view.
3. `0088_report_financial_policy.sql`: neutral trusted report policy and Hospitality policy configuration.
4. `0089_hospitality_reporting.sql`: bounded operational/financial projections with permissions, entitlements and local dates.

Apartelle & Inn is a standard product available through the shared signup, email verification, business and branch setup flow. Business types are Apartelle, Inn and Guesthouse. The shared `create_first_organization` RPC assigns the owner and Free subscription; duplicate submissions retain the existing first-organization protection. No invitation or pilot registry row is required. Existing Hospitality workspaces remain enabled and switchable.

`0090_hospitality_general_availability.sql` removes registry-based access, extends standard business types/onboarding, and enforces the financial-report policy for every Hospitality organization. Historical pilot records remain intact; the old provisioning RPC is revoked from authenticated callers. Old `/onboarding/hospitality` bookmarks redirect to standard onboarding. Dashboard setup points to fixed room rates and staff; Hospitality does not install an appointment-service starter catalog. The homepage, solution page, signup, login, recovery and sitemap all include Apartelle & Inn as a normal product.

`0091_hospitality_cashier_check_in.sql` adds room rate/version fields, nullable guest associations, paid-period metadata, protected financial snapshots and neutral cash tender/change fields. It installs atomic paid check-in, grants cashier checkout, revokes the old arbitrary-price arrival RPC and adds an RLS-invoker availability view. Apply before deploying the new UI. Configure real prices in Rooms administration; no invented prices or customer-data backfill is applied.

`0092_hospitality_room_cleaning.sql` adds cleaning cycle/completion metadata, changes checkout to require cleaning, blocks active-stay creation until ready, installs the scoped ready RPC and updates the RLS-invoker view and report projections. Prior checkout history is not retroactively changed.

No production deployment, hosted schema/data mutation, provider credential change, SaaS pricing change, customer communication or charge was executed. PrivateResortPH was not touched. Review the migrations and run the onboarding and workflow matrix in an approved staging environment before deployment.

## Reproducible local setup

Use Node 24 and the repository's existing local Supabase environment. Apply migrations through 0092 using the project's normal local migration process. Keep a gitignored `.env.hospitality.local` containing the **local** Supabase URL, publishable/anon key and service-role key plus the application's usual local server variables. Do not reuse the hosted `.env.local` values.

```bash
node --env-file=.env.hospitality.local --import tsx scripts/hospitality-seed.ts
node --env-file=.env.hospitality.local --import tsx scripts/test-hospitality.ts
node --env-file=.env.hospitality.local node_modules/next/dist/bin/next build
node --env-file=.env.hospitality.local node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3105
```

The two scripts reject non-local database hosts and `NODE_ENV=production`. Seed is additive/retry-safe for its fixed fixtures; mutation tests create additional synthetic rooms/stays/payments. Run mutation suites sequentially when they share these fixtures.

Local login at `http://127.0.0.1:3105/login`:

- `qa.hospitality.owner@negosu.local.test` — choose **QA Apartelle & Inn** (also has switch access to **QA Other Inn**).
- `qa.hospitality.housekeeper@negosu.local.test` — Operations Staff, cleaning completion without finance, Main branch after integration tests.
- `qa.hospitality.cashier@negosu.local.test` — paid check-in/out, Main branch only after integration tests.
- `qa.hospitality.viewer@negosu.local.test` — operational reports, Main branch only after integration tests.
- `qa.hospitality.frontdesk@negosu.local.test` — Front Desk, Main branch only after integration tests.
- `qa.hospitality.other@negosu.local.test` — separate tenant / Free plan.
- All use local-only password `NegOSu-Local-QA-2026!`.

Fixtures include main/annex/other-tenant branches; vacant/occupied/inactive rooms; unpriced/zero/unpaid/partial/paid/departed-with-debt stays; optional-contact Staff; normal/low stock. Fixture identifiers are written to `/private/tmp/negosu-hospitality-fixture.json`, with no credentials in that file.

```bash
E2E_BASE_URL=http://127.0.0.1:3105 E2E_HOSPITALITY=1 \
  node --env-file=.env.hospitality.local node_modules/@playwright/test/cli.js test \
  e2e/hospitality.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=1
```

The suite explicitly uses Chromium with mobile emulation. Set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome binary when needed. Desktop is 1366×768; mobile sizes are 320×720 and 390×844. Workspace switching and legacy setup redirect checks run once on desktop; their mobile duplicates are deliberately skipped. `e2e/hospitality-entry.spec.ts` additionally tests ordinary signup and full business/branch setup with a fresh synthetic local account, with no invitation. The local test confirms the synthetic email through the local admin API; real email delivery is not exercised.
