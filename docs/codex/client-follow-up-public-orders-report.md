# Client follow-up and public product orders

Implemented in the working tree. No deployment, production migration, payment charge, or customer communication was performed. Database and browser runtime verification remain outstanding.

## Client workflow

Client details now support a reminder reason and local date/time in the active branch timezone. Owners, managers, and advisors can create reminders for active clients, mark them contacted, or cancel them. The Clients directory links to the due count and a paginated manual-contact list with Due now, Upcoming, Contacted, and Cancelled views. Contact details remain visible for manual calls/texts. Creation retries reuse an ID; resolution locks the row and cannot overwrite a different terminal state.

Client appointment history is paginated instead of capped at eight records. It shows service names, status, and branch-local date/time, including a recorded timestamp for walk-ins. Links identify the Clients origin so appointment details offer Back to Clients; direct appointment navigation offers Back to Appointments. The same behavior covers Pet Care appointment details.

Product history reads existing customer-linked Checkout records: issued/partially paid/paid product bills and handed-over promo inclusions, with date/time, quantity, unit, payment status, and returns. Draft and void retail lines are excluded. Promo inclusion time comes from the first recorded handover when available. Historical records without a customer-linked checkout and automotive job parts are not inferred as retail purchases.

## Product and public-order workflow

Product desktop rows and mobile cards reuse RecordRow/RecordItem/RecordLink. Clicking the row opens the existing edit dialog; the separate Edit action is removed for products. Promo behavior is preserved. Named links retain keyboard and modifier-key navigation.

Published active retail products offer Order product. The customer submits one product with a native quantity, contact details, and optional notes. The displayed price/currency/unit must still match authoritative database values. The page retains form input after errors and shows an opaque order reference after success. Orders are explicitly for staff-confirmed pickup and payment; public submission creates neither a stock reservation nor a paid sale.

Owners, managers, and cashiers see pending website orders in the existing notification bell for their active branch. Existing polling refreshes it every 30 seconds while visible, on focus, and when opened. Products → Public orders provides Pending, Confirmed, and Declined history. Staff verify contact/pickup details and confirm or decline. Confirmation atomically:

1. Locks the pending order and verifies tenant, branch, and role.
2. Revalidates product availability, price, unit, and currency.
3. Matches a non-archived client by both normalized phone and name, or creates a client without overwriting another record.
4. Uses shared Checkout to reserve stock and post the product invoice.
5. Marks the order confirmed and opens Checkout for payment and handover.

Exact retries return the original checkout. Insufficient stock or changed prices roll back confirmation. A declined order creates no checkout. Staff use existing invoice/checkout workflows to handle a confirmed sale; confirming or declining sends no customer message. Online payment and delivery are outside the selected workflow.

## Database and security

Apply migrations in order after the existing 0119 migration:

- `0120_client_follow_up.sql`: RLS-protected branch reminders, protected creation/resolution RPCs, narrow product-history RPC, and handover-history index.
- `0121_public_product_orders.sql`: private order requests, branch/role RLS, rate-limited anonymous submission, and protected atomic confirmation/decline RPC.

The unfinished reminder migration was renumbered from 0112 to 0120 because the repository gained a committed 0112–0119 sequence. No committed migration was rewritten.

Anonymous users can submit only a publicly listed product from the requested active storefront. They cannot read order tables, customer data, inventory, or checkout records. Database limits apply per rate fingerprint, normalized phone, and organization. Public browser values never determine authoritative prices, branch ownership, permissions, or payment state. Staff actions scope reads to the active organization/branch; database checks independently enforce access. Product-history projection exposes no inventory cost or margin.

## Files and validation

Changed modules include Clients and appointment routes; product catalog/public product cards; new public product order page/form/action; the staff order page/action; shared CRM/commerce validation; the existing admin-attention loader/bell; two migrations; and unit, SQL, and browser test files.

Executed successfully:

- `node --import tsx --test tests/*.test.ts`: 518 tests passed.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build -- --webpack`.
- Browser fixture compilation for client reminders, public product cards, and product ordering.
- `git diff --check`.

The npm test wrapper could not create its IPC socket inside the sandbox; the same test files passed using Node's test runner with the tsx import hook inside the sandbox.

Added SQL suites: `supabase/tests/client_follow_up.sql` and `supabase/tests/public_product_orders.sql`. They cover retry handling, role/tenant/branch boundaries, invalid input, private products, price tampering, notification clearing, inventory reservation, checkout reuse, and rate limits. **Not executed:** the local Colima database VM did not remain available, and the alternate Docker-context inspection was declined.

Browser tests cover desktop/mobile contact reminders, record navigation, product ordering, pending submission protection, and retained error input. **Not executed successfully:** Chrome could not launch inside the sandbox and the elevated browser test run was declined. Compiling fixtures is not a substitute for browser execution. Mobile/desktop layout received code review only.

Self-review fixed stale-price handling, input retention, mobile wrapping, the migration-number collision, and SQL fixture details. No known code blocker remains, but release validation is incomplete until the database and browser suites run.

## Recommended next step

On a disposable local/staging database, apply 0120 then 0121 and run both SQL suites. Run `e2e/client-reminders.spec.ts`, `e2e/public-products.spec.ts`, and `e2e/public-product-orders.spec.ts` on desktop and mobile. Then verify an actual public order → admin bell → confirmation → Checkout → payment/handover → client purchase-history flow before production release.

## Follow-up: notification schema diagnosis

A metadata-only check against the configured Supabase REST API found `PGRST205` for `public_product_orders` and `PGRST202` for `submit_public_product_order`. The reminders table from 0120 is visible to the API and correctly denies anonymous access. This establishes that the order schema is unavailable through the API; it does not establish whether the physical table is missing or the API cache is stale. A read-only SQL catalog check was requested before recommending a migration repair. No hosted data or schema was changed.

Notification sources now log safe server-side diagnostics. The orders count uses a bounded GET (one ID, exact count) so PostgREST error codes are retained instead of being discarded by HEAD responses. The user-facing partial warning is preserved rather than falsely reporting zero orders. All six targeted notification tests passed.

The SQL Editor subsequently reported SQLSTATE 42601 at the rate-limit IF/CASE expression in 0121. Parenthesized the CASE expression in the still-uncommitted, failed migration. This explains why 0121 did not commit and the order schema was unavailable. Rerun the complete corrected 0121 file; 0120 does not need to be rerun. Whitespace validation passed; database execution of the correction remains unverified.
