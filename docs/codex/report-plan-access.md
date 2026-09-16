# Reports on every plan

Goal: retain reports for every business vertical and plan. Free receives the current branch's last 30 calendar days of summary, daily totals, and customer metrics. Paid plans retain detailed revenue/team breakdowns, branch comparison, custom dates (existing maximum range), and CSV export.

Implementation: reuse the existing Core report reader and reporting RPCs; remove the navigation/page-wide paid gate. Add an append-only migration granting Starter advanced reports and enforcing basic date/branch/output restrictions inside the existing database RPCs. The page ignores advanced query parameters for Free; the export route remains paid-only. Entitlement failures show a retry state.

Security: retain reports.view, membership, branch assignment checks, and RLS. Basic RPCs require one accessible branch and recent local dates. No aggregate across branches or detailed arrays on Free. Revenue breakdown RPC must also enforce the paid entitlement. Subscription cancellation/grace rules continue through effective_entitlements. No production data changes or deployment.

Validation: unit tests for scope resolution and reader behavior; SQL tests for Free/Starter/paid, dates, direct RPC bypass, tenant/branch/role access, and downgrade; existing financial-report reconciliation tests; browser tests for all industries, Free query tampering, export denial and paid reporting, mobile/desktop layouts; lint, typecheck, build.

Deployment: migration 0081 must be applied before releasing the UI. Existing data and function signatures remain intact. No backfill is required.

## Developer validation

Implemented in the report page/export route, Core report reader, reporting filter/access helpers, navigation, plan catalog, and migration `0081_reports_every_plan.sql`. Updated public/Billing feature descriptions for every supported industry. Free is fixed to the active branch and rolling 30-day overview; Starter, Business, Pro, and Multi-Branch have advanced reporting through the existing effective entitlement. Existing financial calculations are reused.

Commands completed successfully:

- `npm test`: 377 tests.
- `npm run check`: lint, typecheck, and production build using isolated local environment values.
- Targeted lint and typecheck after adding the browser suite.
- Local `psql -v ON_ERROR_STOP=1` for migration 0081 and four transactional SQL suites: `reports_every_plan.sql` (49), `phase11_reporting.sql` (20), `shared_appointment_reporting.sql` (16), and `phase12_billing_entitlements.sql` (22). All 107 assertions passed; TAP output checked for failures.
- `playwright test e2e/reports-plans.spec.ts --project=desktop-chromium --workers=1`: 3 tests, one per industry, including Free/Starter/downgrade, query tampering, export permissions, and responsive layout at 320/768/1440 pixels. Local subscriptions restored afterward.
- `git diff --check`: clean.

Self-review: permissions and tenant/branch checks remain authoritative in SQL; no RLS changes, new dependencies, customer communications, or hosted data modifications. Free direct RPC calls cannot retrieve advanced arrays or use unrestricted dates/branches. The export route fails closed on entitlement lookup errors. Financial reconciliation and paid branch access regressions pass. Reviewed desktop and mobile screenshots. No blocking findings remain in local validation.

Remaining release step: apply migration 0081 through the normal database release workflow, then deploy the application. Hosted migration/deployment were not performed in this task. No production validation is claimed.
