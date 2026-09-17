# Full-product QA evidence

Developer-only execution and self-review. Baseline `main`, `416a0d36e6aaf5a431deea80418e4707a2c17c1b`, initially clean; tests apply to the dirty working tree. Node 24.20.0, npm lockfile. Production recommendation: **NOT READY — full requested QA is incomplete**.

Isolated target: Supabase project/container suffix `negosu-full-qa`, API `http://127.0.0.1:56321`, database port 56322. Application production-mode server `http://127.0.0.1:3100`. Hosted `.env.local` values are overridden by the protected local runner. No hosted migrations/data changes, real sends, charges or deployment.

Protected evidence root: `/private/tmp/negosu-full-qa` (700); environment file (600). Do not commit environment, auth state or traces. `test-results/playwright` is ignored. Original baseline logs under test-results/qa were accidentally cleared by Playwright; execution results below remain from the actual session, not retained raw files.

| Actual command / check | Result | Evidence / limits |
| --- | --- | --- |
| `npm ci` under Node 24 | Completed | Initial baseline; transitive audit findings subsequently fixed |
| Baseline `npm test` / lint / typecheck | 438 tests passed; lint/typecheck passed | Original raw baseline logs partly lost; session record |
| `npm test` after currency/date changes | 444 passed, zero skips | `unit-current.log`; rerun after any further behavioral changes |
| `npm run lint`, `npm run typecheck` | Passed after currency/date changes | `lint-current.log`, `typecheck-current.log` |
| `npm run build` with isolated env | Passed after currency/date changes | `build-current.log` is refreshed each build; skeleton-ID rebuild now pending |
| Direct `next start` production build; `GET /health` | HTTP 200, status ok | `server-current.log`; npm prestart production validation correctly rejects local test env, so direct Next startup used for this local-only test |
| `npm audit --omit=dev --json` | Zero vulnerabilities | `audit-current.json`; complete dependency audit still to rerun |
| Fresh Supabase CLI start | Migrations 0001–0096 replayed successfully | Separate temporary project, seed disabled; 0097 subsequently applied transactionally with psql, no production changes |
| `supabase test db` | NOTESTS, not a pass | Replaced by direct SQL execution |
| `python3 /private/tmp/negosu-full-qa/sql-run.py` | 43 suites, 1,401 TAP assertions passed | `sql-current.log`, `sql/summary.json`, per-suite logs. Every suite uses rollback fixtures; runner rejects exit failures/not-ok/empty tests |
| `node --import tsx scripts/test-hospitality.ts` | 86 checks passed | `hospitality-domain.log` |
| `node --import tsx scripts/test-hospitality-pricing.ts` | 39 checks passed | `hospitality-pricing.log` |
| `node --import tsx scripts/test-hospitality-shifts.ts` | 22 checks passed | `hospitality-shifts.log` |
| `PET_TEST_CONTAINER=supabase_db_negosu-full-qa PET_TEST_DATABASE=postgres python3 scripts/test-pet-concurrency.py --apply-disposable-fixtures` | Six database race scenarios and atomicity assertion passed | `pet-concurrency.log`; actual separate concurrent transactions |
| Earlier browser baseline/workflow attempts | Interrupted; not clean passes | `browser-baseline.log`, `browser-workflows.log`; fixture assertions/engine selection/disk pause diagnosed |
| Hospitality, Pet, Pet release, Core parity, walk-in, appointment walk-in; desktop + mobile390 | 52 passed, 8 failed, 2 existing mobile skips | `browser-workflows-2.log`; eight Core fixture/assertion failures subsequently fixed; not final integrated pass |
| Core parity after fixture corrections | Four passed | `review-browser.log`: Automotive/Salon/Pet payment collection, reports CSV, tenant-scoped reads and cashier/viewer access |
| Invalid-date browser regression before fix | Two failed as expected | `agenda-before.log`; confirms old build failure |
| First seven-viewport UI + date/Core review | Four passed, six failed | `review-browser.log`; UI IDs reproduced; assertion targeting fixes diagnosed. No passing visual verdict yet |

## Executed coverage by capability

| Scope | Executed evidence | Remaining scope |
| --- | --- | --- |
| Automotive | SQL RLS/RBAC, jobs/estimates/authorization, parts, work sessions, service history; actual walk-in browser; Core payment/report browser | Complete ordered browser golden path, exhaustive create/edit adversarial forms, every action/route |
| Salon | SQL public booking, scheduling/capacity/payment/queue; actual walk-in failure/retry/idempotency; Core payment/report browser | Complete public-to-completion browser golden path at exact desktop/mobile viewports; exhaustive forms/actions |
| Pet Care | SQL release suite; actual concurrency; browser public request, grooming, notes, payments, lifecycle and onboarding | Final integrated two-pass repetition; all optional staff/contact permutations and action inventory |
| Apartelle/Inn | 147 domain/pricing/shift checks, SQL; browser check-in, charges, partial collection, checkout, cleaning, pricing/deposits, permissions and responsive dialogs | Final integrated two-pass repetition and exhaustive action/viewport mapping |
| Shared Core | 43 SQL suites include tenant/branch/RLS, notifications, billing mocks, stock reservations and financial/report semantics; unit regressions | Full browser auth confirmation/reset/invitation flows, every export/print/action, canonical/legacy matrix |
| UI | Typography classes changed; payment/report screenshots captured at narrow/desktop widths | Actual screenshot inspection, seven exact viewports, keyboard/contrast/zoom, all unique layouts |

Source discovery currently lists 99 route entries and 1,220 control/server-action occurrences. These are not unique features or successful checks. Each candidate remains explicitly unverified until its effects, readback, actor and prerequisites are mapped. No per-vertical full release acceptance is claimed. Emulation is not real-device/virtual-keyboard testing.


## Continuation checkpoint

- `review-browser-2.log`: six tests passed. Date filter recovery in Automotive/Salon plus four UI tests, each covering dashboard/staff/staff-create at seven exact viewports; no overflow, duplicate IDs, or text weight above 500; submit reachable. Eight representative screenshots across all four verticals and all seven widths were actually inspected. Currency rounding/report separator issues were recorded and fixed afterward, so affected screenshots need refreshing.
- `desktop-full.log`: 177 tests executed/considered; 161 passed, 10 failed, 6 skipped. Failures: closed-day appointment fixture, uninstalled starter catalogs, hidden mounted dialog counted as open, and invalid persisted Auth fixture fields. Five PayMongo browser tests require opt-in local provider preload; one mobile-only auth check is inapplicable to desktop. No tests were newly skipped to hide a failure.
- Full desktop execution covered guided chat/replies and limits, booking handoff, public website/map save, report plan gates/export, all Pet width/navigation paths and lifecycle, appointment/walk-in recovery, extensive component forms, Hospitality flows, payment tabs/search and role isolation.
- `pet-concurrency-current.log`: six races plus atomicity pass after fixture Auth defaults repair. Auth listUsers succeeds afterward (count only logged). Two old malformed synthetic users were repaired inside the isolated target; no real accounts changed.
- `migration-up-current.log`: Supabase CLI `migration up --local --workdir /private/tmp/negosu-full-qa` applied/tracked0097 successfully following fresh0001–0096. No hosted execution.
- `access-apply.log`: additive fixture setup completed all four industries; exact local target guard, no password resets. Includes secondary-tenant branches/customers and unassigned/multi-business accounts. Browser access-matrix verification still pending.
- `audit-all-current.json`: all dependencies, including dev, report zero vulnerabilities.
- `regression-current.log` was collected while test-only corrections were still being made; do not treat it as the final fixed-source regression. A fresh invocation is required with test sources held unchanged. Currency fixture cleanup must preserve audit-linked organizations (suspend synthetic workspace/remove synthetic login instead of cascading delete). API client sign-outs now use local scope to avoid revoking browser sessions.
- Latest full unit attempt found one old structural assertion requiring duplicate skeleton/content IDs; it was corrected to require distinct loading IDs and forbid collisions. Earlier 444-pass result predates that skeleton change; current full unit rerun pending.


## Current fixed-source evidence

- `fixed-regression.log`: 13 passed, two failed (multi-business test navigated before login response; currency cleanup attempted deleting an audit-referenced actor). All nine searchable/starter regressions passed.
- `access-currency-final.log`: all six passed after test corrections. Four industry manager/staff cases enforce branch denial, foreign-tenant read denial, report export role denial; unassigned onboarding and all four multi-business selections/reloads pass. Real USD catalog save, partial payment, database currency/amount readback, ledger and dashboard precision pass. Cleanup suspends the synthetic organization and bans its synthetic login, preserving audit references.
- Actual `access-currency-final/.../usd-collections.png` inspected: completed dashboard displays $12.34 under Collected today, readable labels, neutral surfaces and subtle separators. This is a ready-state screenshot, unlike the earlier loading screenshot.
- Subsequent currency review extended existing props to inventory valuation/forms, invoice/job forms, room rates and stay charges; job receipts use stored payment currency. Shared inline service creation now writes server-resolved currency and autocomplete uses record currency. Forged browser currency is ignored in the updated service unit regression. Expanded USD browser scenario also verifies inline creation/search and inventory labels; awaiting rebuilt application.
- Latest `npm test`: **445 passed**, zero skipped. `npm run typecheck` passed after adding the actor currency to API test fixtures. Lint passed. Production rebuild in progress; do not interpret earlier browser evidence as verification of these latest additional currency edits.
