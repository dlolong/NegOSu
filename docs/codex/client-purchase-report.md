# Client purchase report

Implemented 2026-10-15. Reports now opens Client purchases by default (`/dashboard/reports`, also available at `/dashboard/reports/clients`) shows clients with purchases in the selected period, their linked staff, services/treatments and products with quantities, total billed, paid to date, and balance. It uses the existing compact filters and responsive record table. Filters cover preset/custom dates, accessible branches, client name, item name, and purchase type. Results are paginated at 50 client rows; summary totals cover the complete filtered result.

## Files and database

- `app/dashboard/reports/clients/page.tsx`, both report loading routes, and `components/reports/client-purchases-page.tsx`: shared authenticated report, access checks, validation, error/loading states, and navigation to Overview/Product sales. `modules/core/reporting/report-view.ts` resolves the default view and preserves explicit legacy section links.
- `components/reports/client-purchases.tsx`: filters, summary, client links, item lists and pagination. Entry links added to `app/dashboard/reports/page.tsx` and `components/hospitality/report.tsx`.
- `modules/core/reporting/client-purchase-report.ts`: query/result contracts and scoped RPC reader.
- `supabase/migrations/0138_client_purchase_report.sql`: append-only, read-only `get_client_purchase_report` RPC. No tables, policies or existing rows are changed. `0139_client_purchase_staff.sql` extends the same RPC with a `staff` array per client using the existing `staff_work_participation` view; totals remain independent of staff joins.
- Tests: `tests/client-purchase-report.test.ts`, `supabase/tests/client_purchase_report.sql`, `e2e/client-purchases.spec.ts` and its fixture.

Apply migration 0138, then 0139, through the normal migration workflow before using the route. If 0138 is already applied, only 0139 is needed. Production was not modified or deployed.

## Business and security rules

- Salon/pet care use completed appointments and posted retail invoices. Automotive/hospitality use posted invoices. Dates use the appointment date (creation date for unscheduled visits) or invoice issue date in each branch's timezone.
- Totals use authoritative document amounts, including discounts/tax already included there. Invoice balances use the ledger's current stored balance. Appointment payments exclude voided payments. Amounts are read in one statement snapshot; this feature does not mutate financial records.
- Item/type filters select whole appointments/bills. All items and the full total of each matching record remain visible; this is not an allocation of revenue to the searched item. Payments/balances are current amounts on those records, not cash collections within the date range.
- Fulfilled promo inclusions are listed without additional revenue. Draft/void invoices and cancelled/incomplete visits are excluded. Refunds/physical returns are separate from this billed-sales report.
- Staff is deduplicated by staff ID across the matching visits/jobs/stays, including linked product bills. Historical inactive staff and available name snapshots are retained. Unlinked bills/standalone sales show “Not recorded”; the financial actor is not guessed as the service staff.
- Clients merge by customer ID, never name. Automotive job and hospitality guest references also resolve product checkout invoices. Unlinked manual invoices remain separate, labelled rows. Clients without purchases in the selected period do not appear.
- Historical items without saved service/product provenance remain under Other charges, along with accommodation. The report does not guess classifications or infer product purchases from inventory consumption.
- Existing `reports.view`, `advanced_reports`, optional financial-role policy and `can_access_branch` restrictions remain authoritative in the RPC. The server derives the organization from the authenticated context, validates filters and rejects unavailable branches. The SQL guard repeats authorization, date/filter bounds and tenant/branch scoping; anonymous execution is revoked. RLS is unchanged. Error responses do not expose database details.

## Developer validation and self-review

Executed with Node 24.20.0:

- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `node --import tsx --test tests/*.test.ts tests/**/*.test.ts`: 602 passed, including seven report query/reader, staff-contract, and default-view tests.
- `npx playwright test e2e/client-purchases.spec.ts --project=desktop-chromium --workers=3` with local Chrome and fixture routing: three passed at 320, 768 and 1440 pixels. Checked staff names, missing attribution, filter submission, pagination/filter retention, totals, empty results and horizontal overflow; reviewed mobile/desktop screenshots.
- Local PostgreSQL via Docker, `psql -X -v ON_ERROR_STOP=1`: migrations 0138–0139 applied successfully. Report suite: 71 assertions; existing appointment reporting: 16; existing checkout: 111; staff history: 14. All passed and rolled back. Coverage includes all four industries, identity joins, header discounts, duplicate-count prevention, promo inclusions, date timezone boundaries, pagination, empty results, tenant/branch restrictions, report roles, financial-role policy, plan enforcement and anonymous denial. Staff assertions cover all four industries, source-linked product bills, deduplication, missing attribution, inactive staff, snapshot names and tenant/branch exclusions.
- SQL ran only in a disposable database on the local validation VM, assembled from the existing local 0097 schema plus migrations 0098–0139 and system plan/permission seeds. No customer/auth records were copied. The disposable database was removed and the validation VM returned to its stopped state. This was not a fresh replay of migrations 0001–0097 or a hosted migration test.
- Self-review checked changed/new files, authorization before data reads, explicit scoped joins in the security-definer RPC, response validation, semantic control IDs and responsive layouts. Corrected the existing staff-history test setup to assign the service worker before job completion creates immutable history snapshots. No unresolved blocker/high findings. Existing client and reporting workflows are preserved.

## Limits and next step

Browser checks used the actual report component with synthetic data, not a signed-in application connected to the database. After applying 0139 in staging, smoke-test Reports → Client purchases with real staging appointments and checkout bills. Existing advanced-report plan access is retained. Overview remains available through `/dashboard/reports?view=overview`, including on Free. Signed-in plan/hospitality browser suites were updated for this navigation, but were not run in this validation session. CSV export and per-item revenue allocation are outside this request; old uncategorized invoice lines are deliberately not backfilled.
