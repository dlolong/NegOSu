# Product sales report repair

On 2026-10-15, a read-only probe of the configured database returned `PGRST202` (missing RPC) for `get_checkout_product_report`, while `get_checkout` was present and correctly rejected an unauthenticated empty-ID call. The product page's generic “Apply checkout setup” message hid this distinction.

## Implementation

- `supabase/migrations/0140_restore_checkout_product_report.sql` restores the canonical reader from migration 0109 and notifies PostgREST to reload its schema. It is safe to apply whether the reader is missing or already exists. It does not replay checkout tables or modify financial records, stock, access rules, or RLS policies.
- `modules/core/checkout/product-report.ts` validates the response and normalizes page input to a bounded integer. Decimal page parameters previously could reach an integer RPC argument unchanged.
- `app/dashboard/reports/products/page.tsx` uses that reader, logs safe diagnostic codes through the existing error reporter, and presents a retry link without exposing database details or claiming all errors require checkout setup.
- `tests/product-report.test.ts` covers pagination, fractional product quantities, the missing-RPC failure, permission denial, malformed data, and empty results. `supabase/tests/checkout_product_report.sql` covers empty results, page bounds, roles, anonymous denial, and tenant/branch isolation.

## Validation and review

- `npm run lint`, `npm run typecheck`, `npm run build`: passed using Node 24.20.0.
- `node --import tsx --test tests/product-report.test.ts`: four passed.
- Local PostgreSQL: removed the report function in a disposable database, applied 0140, then ran `checkout_product_report.sql` (10 assertions) and existing `shared_checkout.sql` (111 assertions), all passing and rolled back. Reapplying 0140 also succeeded.
- The disposable database used the existing local 0097 schema with system plan/permission seeds and migrations 0098–0140. No customer/auth data was copied. Review confirmed the reader matches the established SQL contract and role/branch checks, contains no business-data writes, and leaves existing RLS intact. No unresolved blocker/high findings.
- Browser layout is unchanged apart from error text and the retry link; a signed-in hosted browser test was not run. The configured hosted database was only probed, not modified.

Apply **0140** in the affected database through the migration workflow and refresh `/dashboard/reports/products`. The hosted error remains until that migration is applied. Do not rerun the original checkout table-creation migration to repair this missing reader. Existing product-report role restrictions remain unchanged; no new reporting/export features are included in this fix.
