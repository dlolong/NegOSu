# Platform administration and dashboard charts

## Implementation

Added a read-only platform console at `/admin`: overview, signups, businesses, subscriptions, PayMongo plan orders, provider billing events, and plan catalog. Directories have stable pagination (25 records), applicable search/status filters, empty states, and controlled errors. Overview has exact platform counts, a billing-attention panel, 30 UTC calendar days of account signups and paid plan receipts, and stored subscription plan distribution. Live and test orders are selected separately; gross receipts are not MRR, net revenue, or customer-service payments.

Charts now appear in the shared automotive/salon/hospitality command center, staff appointment dashboard, pet-care dashboard, technician work dashboard, and hospitality room workspace used by front-desk staff. These charts reuse existing authorized data and branch context. Staff appointments (first 10), technician jobs (latest 100), and room availability (current page, up to 50) explicitly describe their limited samples. Financial values remain separate from activity counts. Charts include visible values, expandable data tables, empty states, and responsive SVG trends without new dependencies.

## Files and boundaries

- Routes: `app/admin/*`; existing dashboard entry points, dashboard layout, and sign-in action.
- Components: `components/platform-admin.tsx`, `components/dashboard-chart.tsx`, command center, and app shell.
- Server access and readers: `lib/auth/platform-admin.ts`, `modules/platform/admin-access.ts`, `modules/platform/admin-reader.ts`; private admin response headers in `lib/supabase/proxy.ts`.
- Shared chart aggregation: `modules/platform/chart-data.ts`.
- Database: append-only `0098_platform_admin_reads.sql` adds two read-only functions. No existing table, tenant policy, branch policy, subscription, or payment is modified.
- Tests: `tests/platform-admin*.test.ts`, `e2e/platform-admin.spec.ts` and its fixture, `supabase/tests/platform_admin.sql`.

Every server reader verifies the authenticated user against deployment-controlled UUIDs before constructing a privileged client. Tenant ownership and editable metadata confer no platform privilege. Missing/malformed configuration denies access. Unauthorized authenticated visitors receive a 404. Both new database functions revoke execution from PUBLIC, anon, and authenticated, and grant it only to service_role. Privileged keys, auth secrets, provider payloads, and raw processing errors are never rendered. Existing tenant RLS and branch restrictions are unchanged. Authorized admins receive a Platform admin link in the workspace account menu; an admin can sign in directly to `/admin` without creating a business.

All new operations are reads, so no new duplicate-submission, mutation-idempotency, or concurrency rules are introduced. Existing payment processing is unchanged. The pre-existing `app/globals.css` edit was preserved.

## Setup

1. Apply migration `0098_platform_admin_reads.sql` through the normal reviewed database migration process. Existing migrations through `0097` are prerequisites. This work did not apply it to production.
2. Keep `SUPABASE_SERVICE_ROLE_KEY` on the server, pointing to the same project as the application's Supabase URL.
3. Set `PLATFORM_ADMIN_USER_IDS` to a comma-separated list of trusted existing **Supabase Auth user UUIDs**, for example `PLATFORM_ADMIN_USER_IDS=<your-auth-user-uuid>`. Find the UUID in the Supabase Authentication user directory. Never use a NEXT_PUBLIC variable, tenant role, or user-editable metadata.
4. Restart the application and visit `/admin`. An empty allowlist disables platform access. No user was automatically granted access by this change.

Remove a UUID and restart the application to revoke access. No additional tenant membership is required. The SQL functions can be removed in a later append-only migration if rolling back this capability; normal tenant workflows do not depend on them.

## Validation and self-review

- `npm test`: 451 passed, including allowlist validation, pagination, chart aggregation, real server-reader guard execution with mocked external boundaries, live/test filtering, and removal of private billing diagnostics.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed using Node 24.20.0. The initial sandboxed build was blocked by Turbopack worker-port permissions; clearing its disposable cache and running with approved permissions resolved it.
- `npm run test:e2e -- e2e/platform-admin.spec.ts --project=desktop-1440 --project=mobile-320 --project=mobile-390 --workers=2`: six fixture-based browser tests passed. Covers the real admin/chart components, readable data tables, empty states, responsive rendering, and horizontal overflow. This is not a live authenticated end-to-end database test.
- Self-review covered authorization before privileged reads, private response caching, exact-ID allowlists, RPC grants, search validation, stable pagination, error sanitization, data definitions, branch scope, sample labels, and existing CSS preservation. Mobile screenshot review identified and fixed cramped currency text.
- SQL security/accounting tests were added but **not executed**: the existing local Colima validation VM did not remain running after startup, leaving its Docker database unavailable. The tests cover direct anonymous/authenticated RPC denial, service-role grants, 30-day series, live/test separation, paid-only totals, signup pagination, literal search, and exclusion of auth secrets.

## Remaining work and risks

MEDIUM: execute `supabase/tests/platform_admin.sql` against a fully migrated local/test database, then exercise authorized and unauthorized `/admin` navigation with real sessions before release. No SQL runtime or live-provider validation is claimed.

Access setup remains disabled until the operator supplies trusted UUIDs and applies the migration. Refunds, charges, suspension controls, plan editing, impersonation, communications, audit-write workflows, Stripe invoice collection reporting, and production deployment are outside this read-only phase. Billing events include both provider environments because that existing table has no environment column. Tenant charts show current operational snapshots, not historical revenue trends.

Next step: configure a development admin account, apply and test the migration locally, then review the console against development data before normal release.
