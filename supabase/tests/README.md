# Supabase tests

`phase01_auth_rls.sql` is a 77-assertion pgTAP suite for onboarding, RLS, grants, and cross-table tenant guards. It creates deterministic Organization A/B fixtures inside a transaction and rolls everything back. Run it against a reset local Supabase database with `supabase test db`.

Minimum matrix:
- user A can read Org A and cannot read Org B;
- user B can read Org B and cannot read Org A;
- inactive membership has no effective access;
- role-specific mutation restrictions work;
- cross-tenant foreign-key attempts fail even when IDs are known;
- anonymous users cannot read internal customers, vehicles, jobs or payments.
- branches, services, appointments, job orders, payments, and inventory remain tenant-scoped;
- Organization A cannot read, insert, update, or delete Organization B records;
- vehicle/customer, service/category, appointment, job item, payment, and inventory relationships reject cross-tenant parents.

Later phases extend this matrix rather than replacing it.

`appointment_vehicle_decoupling.sql` adds the ServiceCore scheduling boundary matrix: appointments with and without vehicles, preserved vehicle FK integrity, cross-tenant vehicle denial, no-vehicle search visibility, automotive queue rejection, and inactive-membership denial.

`customer_digital_estimate_approval.sql` is the KarKR private-link matrix. It verifies hash-only token storage, one active link per estimate, the allowlisted anonymous DTO, explicit anonymous grant denial, exact-version invalidation, approve/decline idempotency, first-decision-wins behavior, expiry/revocation, audit privacy, branch access, and cross-tenant denial.

`trial_credits.sql` tests preservation of existing one-time balances, independent premium gates, paid report/upload retries without credit charges, downgrade preservation, and role/branch/tenant boundaries. `organization_credits.sql` covers the ledger, reservations, acceptance, release/refund, periods, thresholds, private grants, and notices using clearly marked synthetic commercial values inside a rolled-back transaction. Apply migrations through 0145 first.

Run `python3 scripts/test-trial-credit-concurrency.py --local-disposable-database negosu_usage_dashboard_<suffix>` only against a disposable database in the allowlisted local QA container. It tests last-credit races, duplicate reservations, one accepted debit, and concurrent period grants. It restores synthetic configuration and removes its generated fixtures. Hosted connection strings and other database names are rejected. Storage SQL tests use metadata-only fixtures; staging must verify the actual Storage byte transfer.

After migration 0147, run `credit_funded_reports.sql`, `trial_credits.sql`,
`organization_credits.sql`, and `hospitality_general_availability.sql` for the
Free-plan report/CSV credit workflow. Use a clean disposable database: some ledger
assertions count all synthetic rows. All SQL suites roll their fixtures back.

Migration 0149 extends the salon appointment report with visit/receipt details. `client_purchase_report.sql` also verifies client/staff/product display data, exact visit totals with multiple staff and promo inclusions, and full-period sales/collection figures. Run `credit_funded_reports.sql` alongside it to check default access and credit behavior.

After migration 0150, `client_purchase_report.sql` additionally tests automotive linked-job/product bills and pet-care appointment details, including staff deduplication, canonical totals and private-helper/foreign-branch denial.

For migration 0151 run `client_purchase_report.sql`, `multi_service_promos.sql`, `credit_funded_reports.sql` and `hospitality_general_availability.sql`. These cover room/stay amounts, promo snapshot allocation, full-period totals, overview access boundaries, catalog credit idempotency and rejected-request rollback.
