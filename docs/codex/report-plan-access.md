> Current policy (0143–0145): premium access and credits are separate. Existing one-time balances are preserved; Free credits no longer unlock advanced reports or image uploads. These actions have no approved metered cost. See [credits and dashboard configuration](credits-dashboard-report.md) for the current implementation and release requirements. The earlier validation entries below describe their historical migrations.

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

## Shared trial credits (migrations 0141–0142)

Each existing or new business receives one lifetime balance of 100 credits, shared across its members. Accounts initialize lazily; reading availability does not mutate data. Upgrading, downgrading, or inviting another user never resets the balance. An explicitly generated advanced report, prepared CSV export, or successful direct marketing-image upload costs one credit when the effective plan does not include the feature. Included paid features cost zero. Public-page themes/styles and existing basic reports remain free. Credits are not money, and there is no refill, purchase, recurring grant, or automatic subscription change.

The client-purchase report and advanced-report notices link to `/dashboard/reports/trial`. This workspace supports client purchases with staff, business overview for automotive/salon/pet care, and hospitality sections. Filters are evaluated only on Generate/Prepare CSV. Client snapshots include all matching clients and paginate locally without another deduction. Saved CSV downloads are read-only. The latest 20 snapshots belonging to the current user are offered for reopening; snapshot IDs remain readable through the protected read endpoint. Results are capped at 5 MiB; hospitality's existing 10,000-row export limit remains. Narrow oversized queries. Amounts and dates retain the canonical report semantics.

`trial_credit_accounts`, `trial_credit_operations`, and `trial_report_context` have RLS enabled and no browser table grants. Authoritative RPCs lock the business account for spending, store request identity and result, and enforce membership, role, and branch scope. Canonical report readers run inside a private transaction context; ordinary Free RPC calls never gain advanced entitlement. Failures roll back result and deduction together. An identical request returns its saved result; reuse with another payload or user is rejected. Reads recheck the requesting user, role, saved branch set, and financial/inventory permissions, including after exhaustion. Request cost ceilings prevent an included action from silently becoming chargeable if a plan expires while the page is open.

The UI shows the shared balance, action cost, loading/error states, exhaustion, and the plan link. Billing also shows the balance. Browser session storage retains pending request IDs for ambiguous retries; it contains filters and request identity, not report results. Server generation is POST with same-origin enforcement; GET only reads saved results/downloads. CSV cells retain spreadsheet-formula escaping. No service-role credentials are introduced.

Apply 0141 then 0142 through the normal release workflow **before** deploying this UI. There is no production backfill or automatic deployment. Existing report signatures, paid behavior, RLS, basic reporting, and subscription expiry rules remain compatible. Snapshot retention/cleanup and credit configuration/refills are intentionally deferred; retained report data needs the same administrative retention handling as the business's other records.

Validation added: `supabase/tests/trial_credits.sql`, `tests/trial-credits.test.ts`, `e2e/trial-credits.spec.ts`, and `scripts/test-trial-credit-concurrency.py`. SQL covers lifetime grants, all vertical readers, retry identity, failed operations, exhaustion, paid bypass/expiry, table/RPC protection, staff/tenant/branch restrictions, and Storage preflight rollback. The race script accepts only the allowlisted local Docker container and a disposable database name, tests last-credit races across reports/images and duplicate reports, and removes its generated fixtures. See the final implementation report for executed command results. Actual hosted Storage byte-transfer integration is still a staging release check; SQL tests use metadata-only fixtures.

### Executed validation for the credit extension

- `npm run lint`, `npm run typecheck`, and `npm run build` completed successfully under Node 24. The generated `next-env.d.ts` build-only changes were restored.
- `node --import tsx --test tests/*.test.ts tests/**/*.test.ts`: 610 tests passed.
- Transactional local SQL suites: trial credits 54, plan image uploads 13, client purchases 71, shared appointment reporting 16, checkout product report 10 — 164 assertions passed, with TAP output checked for failures.
- Local concurrency script: four races passed (last credit across reports; duplicate report retry; report versus image finalization; two image finalizations). Generated fixtures were cleaned up.
- Browser fixtures: seven report/upload tests passed, covering 320/768/1440-pixel layouts, no spending on filter edits, network retry identity, saved pagination, CSV, exhaustion, paid bypass, and upload retry. The four credit-specific tests were rerun successfully after the final user-scoped retry-key change.
- `git diff --check` passed. Self-review covered new table/function grants, transaction-only entitlement scope, existing branch/financial policy, request replay, cost ceilings, loading/error states, duplicate submissions, and responsive overflow. SQL variable-name conflicts found during validation were fixed; no unresolved blocking findings were found.

The disposable database was removed and the local validation VM stopped. No hosted migration, live upload, customer charge, or deployment was performed. The remaining release check is a staging Storage byte-transfer/retry smoke test before production rollout; snapshot retention and configurable/refillable credits remain outside this phase.
