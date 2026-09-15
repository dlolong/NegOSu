# Core industry parity — Developer Report

## Implementation

The configured database returned **PGRST202** for `pet_care_financial_summary`, explaining the exact Pet Care error reported by the user. A read-only schema probe confirmed that the replacement reader's shared payment, invoice, appointment/customer, and branch projections are available. No hosted data was changed.

Implemented one shared Payments workspace at `/dashboard/payments` for Automotive, Salon, and Pet Care. It provides collected-today totals in the branch timezone, method breakdown, outstanding balances, full payment history, and paginated clickable records leading to the existing collection forms. The old Pet URL remains supported. Pet dashboard financial cards use the same reader. Query errors show a controlled retry state; full-result reads avoid the previous 100-invoice/implicit API-row caps producing understated totals.

Enabled Payments and Reports capabilities/navigation for all supported industries. Salon and Pet Care reports now use appointment service-price snapshots, payment receipts, staff assignments, customers, and branch aggregates. Report pages and CSV share the same reader and preserve role/plan access. Generic labels replace Automotive job/invoice terminology for appointment reports. Fixed Pet resource terminology in shared Settings. Exported text neutralizes spreadsheet formula prefixes.

## Capability audit

| Shared capability | Automotive | Salon | Pet Care |
| --- | --- | --- | --- |
| Organization/branches and tenant access | Existing | Existing | Existing |
| Customer/CRM | Existing | Existing | Existing Pet Owner presentation |
| Services/categories | Existing | Existing Treatment presentation | Existing |
| Staff/login access and scheduling resources | Existing | Existing | Existing; corrected Settings label |
| Scheduling, appointments, assignments | Existing vehicle adapter | Existing | Existing pet adapter |
| Inventory | Existing parts adapter | Existing shared stock | Existing shared stock |
| Payments/history/balances | Unified workspace | Enabled unified workspace | Fixed/unified workspace and dashboard |
| Reports/CSV | Existing invoice aggregates retained | Added appointment aggregates | Added appointment aggregates |
| Public pages, booking requests, notifications | Existing adapter | Existing adapter | Existing adapter |
| Subscription billing and entitlements | Existing | Existing | Existing |

Invoice issuance currently belongs to the Automotive job workflow; Salon/Pet payments use invoice-free appointment references in the same Core ledger. Vehicle inspections, Job Orders, repair queues, and vehicle maintenance remain Automotive-specific. Pet identity, grooming notes, and pickup remain Pet-specific. Reserved Hospitality and Field Service keys have no active product or signup flow; they are not treated as implemented industries.

## Files and database changes

- `modules/core/payments/payment-workspace.ts` and `components/payment-workspace.tsx`: shared financial reader, summary, and UI.
- `app/dashboard/payments/page.tsx`, `app/dashboard/pet-care/payments/page.tsx`, `app/dashboard/pet-care/page.tsx`: shared composition and missing-RPC removal.
- `modules/platform/industry.ts`, `modules/platform/navigation.ts`, `app/dashboard/settings/layout.tsx`: capability parity and terminology.
- `modules/core/reporting/report-reader.ts`, `app/dashboard/reports/{page.tsx,layout.tsx,export/route.ts}`, `lib/reporting.ts`: shared report/export reader, permissions, labels, safe CSV cells.
- `supabase/migrations/0075_shared_appointment_reporting.sql`: append-only read-only reporting function; no table/RLS alterations.
- `tests/core-industry-parity.test.ts`, `tests/platform-foundation.test.ts`, `e2e/core-industry-parity.spec.ts`, `supabase/tests/shared_appointment_reporting.sql`: regression coverage.
- Core/industry/database documentation, implementation plan, and this report.

## Security and business rules

Reads use authenticated clients, explicit active organization/branch predicates, and existing RLS. Payment pages are restricted to owner/manager/cashier; viewer and technician access is not granted by navigation alone. SQL reporting independently enforces report permission, advanced-report entitlement, and accessible branch scope. Cross-tenant and foreign/unassigned branch requests are denied. Report viewers receive approved aggregates without broadening ledger permissions. New SQL has a fixed search path and no anonymous execute grant.

Collection still uses existing payment mutation RPCs, including their validation, row locks, totals, and retry/idempotency rules. Browser checks record synthetic local payments only. No online charges, external communications, hosted migrations, or production deployment occurred.

## Validation

- `npm test`: **342 passed**.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed with Node 24; build uses local test configuration.
- New appointment-report SQL suite: **16 assertions passed** (financial/date semantics, tenant/branch scope, roles, empty Pet report, entitlement, anonymous denial).
- Existing SQL suites: Automotive reporting **20**, Salon foundation **74**, Pet Care **58** assertions passed.
- New browser parity suite: **4 scenarios passed** across all supported industries, shared page rendering, received-payment collection/history, reports/CSV, cashier/viewer behavior, and cross-tenant reads.
- Existing release smoke: **11 scenarios passed**.
- Payment layout checks: 320, 390, 1440px; report layouts: 320 and 1440px. Screenshots are retained under `/private/tmp/negosu-core-parity-browser-results/`.
- `git diff --check`: passed.

Validation logs: `/private/tmp/negosu-core-parity-*.log`. SQL tests use transactions and roll back their fixtures. Browser role tests clean up their temporary users; synthetic manual-payment records remain in the local QA dataset. Early browser harness failures were corrected for collapsed navigation groups, missing invoice fixtures, and the existing Pet success redirect without a message query.

## Self-review, limits, and deployment

Reviewed tenant predicates, query failures, nulls, empty states, role/plan controls, report semantics, CSV injection, stable DOM IDs, and phone/desktop layouts. No known blocking issue remains in the changed implementation. The shared ledger reader aggregates paginated records in application memory for compatibility with the configured schema; very large histories may warrant a future database aggregate. Financial page reads are live display summaries, not an atomic accounting snapshot or a replacement for authoritative collection RPCs.

The full historical SQL suite was not rerun. Earlier work documented three pre-existing Automotive operations assertions outside this scope; the relevant finance/report/Salon/Pet suites above pass. Browser validation is Chromium only. Provider delivery and production behavior were not exercised.

**Deployment requirement:** apply migration **0075** in order before deploying the new appointment reports. Payments itself requires no new migration, but existing payment-write functionality still depends on prior payment/scheduling migrations. The configured database was inspected read-only; 0075 was applied only to local validation PostgreSQL. Changes are reviewable and have not been deployed.
