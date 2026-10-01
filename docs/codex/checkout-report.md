# Shared Checkout — Developer Report

## Executive Summary

Implemented one shared Checkout → Payment → Receipt workflow for Automotive, Salon, Pet Care and Apartelle & Inn. Product-only sales use the same workflow with a real customer. Operational completion remains separate from recording payment and product handover.

Migration required: **YES — 0109 followed by 0110**. Production migration executed: **NO**. No deployment, customer communication or payment-provider charge was performed.

## Existing Commerce Architecture Reused

Reused `inventory_items`, inventory reservations/operations/movements, appointment service and promo snapshots, existing invoices/invoice items, canonical appointment and invoice payment functions, customers, branch permissions, standard form dialogs, report authorization, invoice voids and payment reversals. Core Checkout imports no vertical domain module.

## Shared Checkout Architecture

Business context → shared checkout → accepted products / promo inclusions → additional posted invoice → canonical payment allocations → receipt.

A checkout references an existing appointment, an existing invoice, or a customer for a product-only sale. It stores composition, fulfillment and retry receipts; invoices and payments remain the financial source of truth. Original charges are not copied or rewritten. New product batches become additional neutral invoices. Existing invoice states provide financial status; no parallel payment ledger or per-vertical cart was introduced.

## Checkout Page

Contextual entry buttons replace the primary direct-payment buttons on salon appointments, grooming visits, job orders and stay charges. Checkout shows the customer, existing charges, fixed-price promos, included services/products, added products, tax/discount carried by existing bills, total, paid and balance.

The standard product dialog searches by name, product code and category, with branch-scoped pages of 20 products. It shows native units, selling price, available stock, quantity and calculated preview. The database independently resolves price and validates stock. No cost or margin is exposed.

Desktop uses order and summary columns. Mobile uses one main page scroll and the existing fullscreen dialog. Important buttons and fields have stable semantic IDs. Recent checkouts are accessible from the product-sale entry to resume drafts and release unwanted draft reservations.

## Product Sales

- Service-related purchases share the existing visit/job/stay context.
- Products → New sale selects a customer without creating a fake appointment, job or stay. Cashiers also have an entry from Payments.
- After posting, further purchases create additional invoices. Posted quantities/prices cannot be silently edited.
- Unposted, unfulfilled products can be edited; quantity zero removes the line and releases its reservation.

## Inventory

Accepting a tracked product reserves its quantity. Searching, viewing and changing the preview do not mutate stock. Explicit **Confirm handover** consumes the reservation and posts the physical movement once. Non-stock products retain fulfillment records without physical movements.

Removal releases unfulfilled draft reservations. Voiding an unpaid additional invoice releases its remaining allocations without inventing a physical return. Cancelled/no-show visits release uncollected promo inclusions, including authorized self-service cancellation. Zero-priced product bills can still be voided before handover.

**Record return** restores only quantities actually handed over and not already returned. It does not refund money. Native quantities support three decimals; no packaging conversion is inferred. Existing job parts and internal supplies are not consumed again.

## Payments

Payment resolves existing charges, additional invoices and valid payments on the server. It rejects unreviewed draft additions and overpayment, permits partial payments, and records canonical allocations atomically. The original bill is settled first. Exact retries return existing results; changed retry payloads are rejected.

Payment has amount, method, reference and date fields and a Back to checkout link. Recording payment neither charges a provider nor completes the operation. Existing refund/reversal and invoice-void workflows remain separate from physical returns.

## Salon

Appointment / completed service → Checkout → accepted promo inclusions and retail additions → explicit handover → Payment → Receipt. Promo pricing remains the agreed snapshot. Internal treatment supplies are excluded from checkout fulfillment.

## Automotive

Approved estimate → existing issued job invoice → Checkout → accepted retail additions → Payment → separate vehicle release. Original labor, approved parts and consumed-part history remain untouched. Unpaid or unposted checkout additions block vehicle release; paying does not release the vehicle automatically. The advisor's recommended payment action also opens Checkout.

## Pet Care

Completed grooming visit → Checkout → pet-owner purchases / promo inclusions → explicit handover → Payment → Receipt. The pet detail record and existing pickup lifecycle remain intact. Checkout/payment does not mark the pet collected.

## Apartelle & Inn

Existing stay bill → Checkout / Review charges → guest purchases → Payment → explicit room checkout. Product debt participates in the existing debt-acknowledgement policy. Deposits remain separate. Payment does not clear occupancy or skip deposit/cleaning rules. Standalone retail bills appear in hospitality collections and outstanding balances.

## Reports

Added a branch-scoped Product sales & handover report, including sold quantity, included quantity, handover, returns, posted sales, paid and balance. It uses stored commercial snapshots and excludes voided invoices from sales.

Existing appointment reports include posted retail revenue and balances; payment collections already use the shared payment ledger. Invoice revenue allocations are populated for retail lines and retain fractional quantities. Hospitality collections/outstanding queries include product invoices once. Promo inclusions contribute no extra revenue. Inventory movements remain in existing inventory reporting.

## Permissions / RLS

| Boundary | Result | Evidence |
| --- | --- | --- |
| Tenant isolation | PASS | Other-tenant product selection, checkout reads, catalog searches, payment and handover denied in SQL tests. |
| Branch isolation | PASS | Cross-branch products and branch-restricted cashier sales denied; canonical void path now checks branch access. |
| Financial access | PASS | Checkout limited to owner/manager/cashier; service-only and anonymous access denied. Existing report authorization retained. |
| Inventory access | PASS | Private ledger helpers inaccessible to clients; raw reservation calls cannot mutate checkout reservations; explicit checkout mutations validate context. |

New tables have RLS. No direct authenticated writes are granted. Price, ownership, current balance, stock and state are authoritative in the database. Financial/stock changes have audit records and retry receipts. The private cancellation-release exception checks that the exact inclusion belongs to a cancelled/no-show appointment; it is not client callable.

## Database

- `0109_shared_checkout.sql`: composition and fulfillment records, private retry receipts, protected RPCs, inventory facades, immutable posted bill guards, financial/stock lifecycle handling, audit records, branch-scoped product report, numeric invoice quantities.
- `0110_checkout_vertical_policies.sql`: vehicle-release and stay-checkout balance integration, hospitality financial projection, existing report reconciliation.
- Historical transactions require no backfill. Existing invoice/payment API signatures remain available.
- Apply both migrations in order to the app's configured database before using Checkout. Test on staging and follow the normal backup/release procedure. This work did not modify the hosted database.

## Files Changed

Implementation is in `modules/core/checkout/`, `app/dashboard/checkout/`, shared `components/checkout-*.tsx`, the four operational detail pages, invoice detail, Products, Payments and reporting surfaces. Additional routes are `/dashboard/payments/ledger` and `/dashboard/reports/products`. No permanent Checkout sidebar entry was added.

Validation files: `tests/checkout.test.ts`, `supabase/tests/shared_checkout.sql`, `e2e/checkout.spec.ts`, its fixture, and the two local database validation scripts. The bounded implementation plan is `docs/codex/checkout-plan.md`.

## Tests

Commands executed with Node 24.20.0 on PATH:

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
python3 scripts/test-checkout-db.py
python3 scripts/test-checkout-concurrency.py --local-disposable-copy
E2E_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e -- e2e/checkout.spec.ts --project=desktop-chromium --project=mobile-375 --project=mobile-390
git diff --check
```

Results:

- Lint: passed without warnings; typecheck: passed; production webpack build: passed.
- Unit tests: **488 passed**.
- SQL: **245 assertions passed** — shared checkout 95; inventory reservations 54; service advisor 29; appointment promos 18; multi-service promos 32; hospitality general availability 17. Deferred constraints are checked in the checkout suite.
- Concurrency: only one competing checkout reserved the last unit; duplicate handover produced one physical issue; duplicate payment produced one allocation per bill and zero remaining balance.
- SQL suites ran in rollback-only transactions on the local QA database. Concurrency ran in a disposable local database copy, removed afterward.
- `git diff --check`: passed.

Initial sandbox restrictions blocked the test runner IPC socket and Chrome; approved reruns succeeded. A local database restore needed the Supabase administrator role. Initial SQL naming ambiguity and nondeterministic allocation order were fixed before the final passing runs.

## Browser QA

| Viewport | Result |
| --- | --- |
| 1366×768 | PASS — product dialog, exact quantity preview, explicit add/handover, payment form, error message and no horizontal overflow. |
| 375×812 | PASS — same checks with the mobile dialog and reachable actions. |
| 390×844 | PASS — same checks with the mobile dialog and reachable actions. |

Six browser tests passed. These render the actual shared checkout/payment components with synthetic data and intercepted server-action boundaries. Database/security behavior is covered separately by SQL tests; a signed-in hosted end-to-end transaction was not executed.

## Four-Vertical Regression

- Automotive: **PASS** — actual approved invoice, checkout retail additions, partial/final settlement and explicit release policy; existing advisor/parts suites also passed.
- Salon: **PASS** — completed service charge, retail additions, promo inclusion handling, returns and report reconciliation.
- Pet Care: **PASS** — completed appointment with a real pet detail record, shared product/payment flow and deferred integrity checks.
- Apartelle: **PASS** — real stay/bill, product debt, settlement without automatic room checkout, explicit checkout and standalone retail reporting.

These results describe automated database/component coverage, not four authenticated hosted-browser sessions.

## Self-Review Findings

Fixed SQL name ambiguity, original-bill allocation ordering, missing retail revenue allocation, missing product balances in existing reports, standalone hospitality report links, private stock access, void branch enforcement, product identity changes after checkout history, cancellation reservation release and the zero-price void edge case. No known blocking defect remains in the implemented workflow.

## Remaining Limitations

- Hosted/staging migration and authenticated pilot validation remain deployment work; no production changes were authorized.
- Refunds retain the existing payment-reversal model; this phase does not introduce item-level credit notes or a new partial-refund engine.
- Retail additions use catalog final prices. Existing base-bill tax/discounts are shown; no new retail tax or discount engine was introduced.
- The dedicated product report is all-time for the active branch. Existing financial reports retain their date/scope filters; service average-ticket and visit-count metrics remain service-based.
- Legacy direct-payment endpoints remain for compatibility; the primary contextual navigation now goes through Checkout.

## Recommended Next Phase

Apply migrations to staging, run authenticated pilot transactions for each enabled vertical, then refine receipt/return UX from actual cashier feedback. Keep the shared commerce boundary.

## Checkout loading repair

Migration `0111_restore_checkout_summary.sql` restores the current `get_checkout` reader for databases that applied an earlier checkout definition, including the fix for an ambiguous `invoices` variable. It preserves authenticated-only execution and tenant/branch authorization, and does not mutate transaction data. Apply after 0109 and 0110. The reported hosted error has not been independently reproduced; the loader now logs only the database error code to support diagnosis without disclosing customer data.

Validation: local rollback-only shared checkout suite passed 103 assertions, including the summary contract across all four verticals; three checkout unit tests, targeted ESLint, TypeScript checking and `git diff --check` passed. No hosted migrations were applied. Existing mobile/desktop layouts are unchanged; browser and production build checks were not repeated for this reader repair.
