# Payments navigation Developer Report

## Implementation summary

Payments now uses two shared, URL-based views across Automotive, Salon and Pet Care: Outstanding (default) and History. Both have searchable, clickable tables and 25-row pagination. Two compact cards explain today's collections and the remaining amount to collect. The method breakdown is collapsed under History.

## Files changed in this refinement

- `components/payment-workspace.tsx`: shared tabs, tables, search, summaries, empty results, pagination and responsive column layouts.
- `modules/core/payments/payment-view.ts`: query normalization, search, stable sorting, pagination and URL generation.
- `app/dashboard/payments/page.tsx` and `app/dashboard/pet-care/payments/page.tsx`: shared query contract.
- `tests/payment-view.test.ts`: six focused regression tests.
- `e2e/payment-navigation.spec.ts`: navigation and responsive table scenarios for all three industries.
- `e2e/core-industry-parity.spec.ts`: collection assertions follow History; denied access checks the whole payments page.
- `e2e/pet-care-release.spec.ts`: public booking-to-payment verification uses a unique payment reference in History.

## Database, business rules and security

No new migration, schema change, RLS change, or payment mutation logic in this refinement. Existing authenticated, tenant/branch-scoped Core readers and authoritative invoice/appointment payment forms are reused. Filtering only changes displayed rows; branch totals include all records. Existing Pet URLs and earlier pagination URLs remain supported. Repeated query parameters are normalized safely.

## UI and accessibility

Outstanding rows open their invoice or appointment to record payment. History rows open the related record. Native links retain keyboard navigation; shared RecordRow supports clicking the remaining row area. Search and clear actions have accessible names and icons. Active tab indication, table captions/column headings, status badges, semantic IDs and empty-result messages are included. Smaller screens group secondary details under the customer and amount instead of adding page overflow.

## Validation performed

- `npm test`: 348 tests passed, including six new search/pagination regressions.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed using isolated local Supabase configuration.
- Playwright Core industry parity: four scenarios passed, including collection in all three industries, report/export regression, cross-tenant reads and cashier/viewer permissions.
- Playwright payment navigation: three scenarios passed. Covered tab state, customer search, empty search, clear, preserved filters, row navigation, browser Back, repeated query parameters and the legacy Pet URL.
- Playwright public grooming request: one scenario passed through booking, staffed visit, payment and History verification.
- Both populated tables checked for content overflow at 320, 390, 768, 1024 and 1440 pixels across all three industries. Desktop and 320px screenshots visually reviewed.
- `git diff --check`: passed.

Commands used for browser checks (through the protected local environment wrapper):

```sh
npx playwright test e2e/payment-navigation.spec.ts e2e/core-industry-parity.spec.ts --project=desktop-chromium --workers=2
npx playwright test e2e/payment-navigation.spec.ts e2e/pet-care-release.spec.ts --grep 'payment tabs|public grooming request' --project=desktop-chromium --workers=2
npx playwright test e2e/payment-navigation.spec.ts --project=desktop-chromium --workers=2
```

The initial navigation test had a text-whitespace assertion mismatch; corrected to compare rendered text consistently. Screenshot checks were strengthened to wait for cleared filters and populated tables. The final three navigation scenarios passed. An unescaped apostrophe lint finding was fixed before the final build.

## Self-review, known risks and scope

Reviewed shared UI/query code, route types, financial-data boundaries and changed tests. No unresolved blocker or high finding identified for this refinement. All browser checks used Chromium and synthetic local data; other browser engines and a hosted deployment were not validated. No production data or deployment was changed. Financial SQL was unchanged, so its earlier regression suite was not repeated here. The earlier reporting migration 0075 remains a separate deployment requirement from the Core parity phase.

Next step: review Payments in the workspace; no additional database setup is needed for these tabs and tables.
