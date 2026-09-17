# Developer report: Apartelle pricing, extensions and deposits

## Implementation

Six room packages: 3/6/12 hours, 1 day, weekly (7 days), monthly (30 days). Owners/managers configure the base price and optional price per extra hour in Rooms. Cashiers enter the final discounted price and discount type, with card number required for discount card/PWD/senior. Other discounts need no identity number. No percentage or eligibility calculation is introduced.

Check-in commits stay, net accommodation charge, payment and optional refundable deposit together. Cash change uses final price plus deposit. Complimentary room prices work without artificial payments. Each stay retains the agreed rates. Paid hourly extensions update the end time atomically, with stale-period rejection and exact-retry handling. Older stays can explicitly select a configured hourly rate if their original snapshot has none.

Paper receipt numbers are optional at arrival, extensions and additional collections; the stay receipt number remains editable. Checkout requires confirmation of the full deposit return, then sends the room to Cleaning. Payments, reports, CSV and statements keep deposits separate from room revenue. The combined Rooms table and housekeeping release workflow remain intact.

## Files and database

- Core: `0093_core_refundable_deposits.sql` adds finance-protected invoice deposits, receipt fields, deposit-aware cash arithmetic and internal hold/refund routines.
- Hospitality: `0094_hospitality_pricing_extensions.sql` extends rates, arrivals, protected extension records and checkout. The old paid-arrival RPC remains a compatibility wrapper. `0095_hospitality_deposit_reporting.sql` adds deposit reporting and export projections.
- Actions/contracts: `app/dashboard/hospitality/actions.ts`, `modules/hospitality/contracts.ts`, report export module/route.
- UI: shared settlement and extension forms; room-rate editor; check-in, Rooms, stay details/statement; Payments/Reports tabs. Public Apartelle page copy reflects the implemented workflow.
- Verification: `tests/hospitality.test.ts`, `scripts/test-hospitality-pricing.ts`, `e2e/hospitality.spec.ts`.
- Documentation: Hospitality, deployment, role policy, phase plan and this report.

Migrations applied successfully to the local development database and separate local replay database. No committed migration was modified, no existing customer record was backfilled, and no hosted schema/data change or deployment occurred.

## Security and self-review

Reviewed diffs, SQL constraints/RLS, RPC grants, authoritative calculations, role/tenant/branch checks, invoice ownership, serialization/retries, null/zero/legacy data, financial errors, stable DOM IDs and responsive dialogs. Financial writes require owner/manager/cashier; front desk can read finances but cannot return deposits. Operational staff cannot read deposit/discount/extension financial records. Internal deposit mutation functions are not directly callable by authenticated users. Card numbers are masked on stay details and omitted from exports/audit metadata.

Room → stay → invoice locks serialize checkout/extensions; unique request keys and expected end/version comparisons reject duplicate or conflicting changes. A failed checkout rolls the deposit refund back. Existing payment refunds do not refund the separate deposit. Core payment and branch RLS regression suites remain passing.

Self-review fixes: correct arrival change when a deposit/discount exists; paginate extension history; explicitly label unreturned deposits; retain extension access for legacy stays without a planned end; include zero-price cash tender/change on statements. No known unresolved blocker or high-severity finding.

## Validation

- `npm test`: 397 passed.
- `npm run check` (`lint`, `typecheck`, production `build`): passed.
- Local `scripts/test-hospitality.ts`: 86 passed.
- Local `scripts/test-hospitality-pricing.ts`: 39 passed, including actual concurrent arrivals/extensions/checkouts, exact retry/change rejection, manual discounts, required card numbers, monthly duration, snapshot rates, legacy fallback, noncash collections, cash change, deposits, zero-price arrivals, receipt edits/retries, RLS and cross-branch/tenant rejection.
- Local pgTAP: `phase05_06_jobs_finance_rls.sql` (53) and `hospitality_general_availability.sql` (17): 70 passed.
- Hospitality Chromium browser suite: 17 passed across desktop 1366×768 and mobile 320×720 / 390×844; four duplicate desktop-only scenarios intentionally skipped. Includes the full monthly-discount/deposit/extension/receipt/refund workflow and existing room/cleaning/report/permission flows.
- Final-build targeted browser rerun: 3 passed (desktop and both mobile sizes), including extension and receipt Cancel buttons.
- Desktop/mobile screenshots inspected; form overflow, background scroll lock and action completion checked in-browser.
- `git diff --check`: clean.

Tests use guarded local synthetic fixtures only. Next occasionally logs the existing “destination stream closed early” message during rapid browser navigation; no corresponding workflow assertion or server-action failure occurred. External payment/refund delivery is not exercised: these features record money already received/returned by the business.

## Rollout and limits

Apply reviewed migrations 0093–0095 before deploying this UI, then configure real monthly and hourly extension prices in Rooms. Existing rate snapshots remain unchanged. Hosted rollout requires the normal authorized operator process. An older UI cannot check out a stay with a held deposit; retain refund-capable UI or use a forward fix.

Full deposit return only. Partial deposit deductions, prorated/fractional-hour extensions, automatic discount percentages/tax calculations and online guest payment processing are outside this request. Final prices range from zero to the quoted base price. Extension hours are added to the prior paid end, including any overdue time; occupancy never ends automatically.
