# Product details and histories

Product list rows/cards now open `/dashboard/products/[productId]`. A separate Edit action is restored on desktop and mobile, and the detail page also links to the existing edit dialog. RecordRow/RecordItem keep their normal link/keyboard behavior and do not intercept Edit clicks.

The detail page shows the product photo, description, category, product code, selling price, unit, purpose, status, public visibility, and tracked stock on hand. Its paginated views read existing records:

- Usage history: usage, consumption, waste, and return movements with signed quantity, notes, and date/time.
- Customer purchases: posted Checkout product lines and handed-over promo inclusions, customer name, quantities, bill status, handover/return quantities, recorded/billed date/time, and a link to Checkout. Voids stay explicitly labeled; unposted drafts and removed lines are excluded.
- Stock purchases: inventory purchase movements with received quantity, notes, and date/time.

Files: `components/commerce-catalog-page.tsx`, `app/dashboard/products/[productId]/page.tsx`, `modules/core/commerce/product-history.ts`, `tests/product-history.test.ts`, and the existing public-product-order browser fixture/spec.

No schema, migration, RLS, mutation, or payment-rule changes. The detail route matches the catalog's owner/manager and supported-industry access. Product and history reads use the authenticated Supabase client, explicit organization/active-branch/product filters, and existing RLS. Purchase history joins protected Checkouts. Invalid IDs and inaccessible products return not found; load failures, empty history, and untracked stock have explicit states. Dates use the branch timezone.

Self-review checked row versus Edit navigation, tenant/branch filters, exclusion of draft purchases, pagination, null invoice handling, and mobile wrapping. No known blocking code defect found. The source records determine history coverage; legacy purchases without Checkout lines and non-stock consumption without a ledger entry cannot be reconstructed here.

Added three focused tests for history scope, movement categories, purchase filtering, and tab selection. Updated the browser regression to distinguish opening product details from clicking Edit. The fixture compiles; browser execution remains unverified because the previous Chrome escalation was declined. No deployment or hosted database changes were made.

Manual verification: open a product on desktop/mobile, click Edit separately, switch all three history tabs, check an empty product, and confirm another branch's product URL is inaccessible. Inspect a posted/voided bill and returned purchase via the Checkout link.

Validation passed: `node --import tsx --test tests/*.test.ts` (522 tests), `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`, browser fixture compilation, and `git diff --check`. Live authenticated database histories and desktop/mobile browser behavior were not executed in this turn.
