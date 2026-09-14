# Inventory workspace — developer report

## Implementation summary and files

- `app/dashboard/inventory/page.tsx`: scoped server loading, active-branch history, explicit query errors, and organization timezone.
- `components/inventory-workspace.tsx` and `lib/inventory-workspace.ts`: full-width stock table/cards, summary links, search/category/status filters, twenty-product pagination, movement history, dialog routing, matching transfer options, and safe return URLs.
- `components/inventory-forms.tsx`: focused Add product, Record movement, Transfer stock, and automotive recipe forms. Required labels, semantic IDs, icons, category suggestions, optional metadata, controlled drafts, and shared right-aligned Cancel/Save.
- `app/dashboard/inventory/actions.ts`: action error states, scoped ownership checks, existing RPC reuse, cache refresh, and successful return to the filtered inventory view.
- `app/dashboard/inventory/loading.tsx`: accessible loading skeleton matching the workspace.
- `components/submit-button.tsx`: optional explicit disabled state combined with existing pending protection.
- `lib/inventory.ts`: real-date validation for optional expiry dates.
- Added inventory unit/browser tests and fixture; updated the moved-form source contract in `tests/product-experience.test.ts`, plus UI/testing documentation.

## Database, business rules, and security

No database migration or RLS change. Existing ledger, RPCs, row locking, reservation protection, and database idempotency remain authoritative. No service-role client, production mutation, or deployment was used.

Inventory actions require owner/manager access. Movement and recipe inputs resolve products in the active organization and branch; recipe services must be active in that organization. Recipe actions reject Salon accounts. Transfers resolve both products through the authenticated client and active organization, require different branches, then delegate stock/SKU/access checks to the existing transfer RPC. Error messages avoid raw database details. Return navigation is restricted to inventory with allowlisted filter parameters.

Products still start with zero stock; opening balance is a separate movement. Stock status distinguishes zero/negative physical balance, positive balance at/below reorder level, and above-threshold stock. History intentionally changes from organization-wide to the selected branch. Existing product and movement data remain compatible.

## Validation

- `npm test`: 301 tests passed, including six new inventory helper/validation tests.
- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:e2e -- e2e/inventory.spec.ts e2e/form-actions.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`: 87 passed (36 inventory checks and 51 existing form regressions). Used installed Chrome and synthetic action boundaries. Additional in-test widths cover 768, 1024, and 1280 pixels with a simulated sidebar.
- Local PostgreSQL `psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -f ...`: 43 assertions passed in `phase07_08_inventory_retention_rls.sql` and 54 in `parts_reservation_consumption.sql`; both ended in ROLLBACK, with no failed assertions.
- Reviewed desktop and 320px inventory screenshots, including long product names, SKU/category values, units, stock quantities, and action widths.

## Self-review and limitations

Reviewed diffs and new files for tenant/branch scope, server authority, missing records, null metadata, failure/pending/empty states, duplicate submission controls, navigation destinations, responsive overflow, and backward compatibility. Corrected narrow inline movement forms, missing cache refresh after product/recipe saves, lost drafts after rejected submissions, hard-coded history timezone, and overly strong table borders. No blocking findings remain in this change.

Browser tests use real components/CSS with stubbed server actions; database behavior was exercised separately in local rollback-only tests. A logged-in browser-to-database persistence run and native Safari testing were not performed. High-volume inventory performance was not benchmarked. Ledger editing, product deletion, and Salon treatment consumption remain outside this UI improvement.

Recommended next step: review the local Inventory page using a test owner/manager account, then follow the normal release workflow. No production deployment is included.
