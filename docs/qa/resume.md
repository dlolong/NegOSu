# Full-product QA checkpoint

Baseline: `main`, `416a0d36e6aaf5a431deea80418e4707a2c17c1b`; initially clean tree.
Developer-only execution. No subagents or independent QA.

## Bounded implementation plan

Goal: verify existing features/actions across four verticals, fix reproduced defects, standardize shared UI and retain release evidence.

Existing capabilities: shared Core auth, membership/branches, scheduling, payments, inventory, reporting, billing and outbox; Automotive work execution; Salon appointments; Pet grooming; Hospitality rooms/stays. Existing unit, SQL, browser and synthetic fixture infrastructure will be reused.

Affected modules: QA setup/safety, Playwright coverage, shared UI/formatting and specific reproduced defect boundaries. Add no new vertical domains.

Database: isolated local/disposable validation only. Append-only migrations only for a reproduced schema defect. No hosted mutations or applied-history edits.

Security: keep real authenticated identities, authoritative roles, tenant and branch predicates, RLS and RPC checks. Disable external delivery and payment providers in QA.

Business rules/backward compatibility: preserve existing financial/state semantics and historical records; distinguish missing prices from free, charges from collections, and operational Staff from login access.

UI: acceptance standard in `ui-standard.md`; verify shared changes across consuming verticals, exact widths, keyboard interaction and actual screenshots.

Testing: baseline → reproduction → focused regression → SQL/RLS/concurrency → authenticated workflows → production build/health → two clean critical passes after final code changes.

Acceptance: each inventoried item has an honest result; no discovered unresolved in-scope defects; golden paths and applicable security/financial checks verified. A blocker or unexecuted item prevents a full release-ready claim.

## Current checkpoint — 2026-09-17

- Baseline main/416a0d36 remains uncommitted; all phase work is in the shared dirty tree. Do not discard it or spawn agents.
- Node 24.20.0: `/Users/mardi/.nvm/versions/node/v24.20.0/bin/node`; runner sets PATH correctly. Default shell Node 23 is not the release target.
- Hosted `.env.local` must never supply QA mutation targets. Isolated Supabase project `negosu-full-qa` is running at API 56321 / DB 56322. Existing `karkr` and other project databases were not reset or seeded.
- Protected local configuration/runner: `/private/tmp/negosu-full-qa/environment.json` (600) and `run.mjs`. Runner asserts API exactly `http://127.0.0.1:56321`, injects local keys/test flags, disables delivery/providers. Never print or commit its contents.
- Safe command prefix: `/Users/mardi/.nvm/versions/node/v24.20.0/bin/node /private/tmp/negosu-full-qa/run.mjs` followed by `npm ...` or `node --import tsx scripts/...`.
- App production build is served at 3100 by our own direct Next server. Use `lsof -n -iTCP:3100 -sTCP:LISTEN` to identify only that server before rebuilding. Leave the user's separate dev server untouched. Current server log `server-current.log`.
- Last behavioral suite: 444 unit tests passed, lint/typecheck passed; production build and `/health` passed. Latest skeleton-ID build also completed. Re-run final checks after further edits.
- SQL: migrations 0001–0096 replayed fresh. 0097 applied transactionally only to isolated QA DB. It adds currency projections/payment currency and removes inherited anonymous payment EXECUTE; no RLS weakening or historical data changes. Full SQL run: 43 suites/1,401 assertions passed. 0097 not recorded in disposable CLI migration tracking because applied directly; verify clean migration replay before claiming full migration gate.
- Actual DB evidence: Hospitality domain 86 + pricing39 + shifts22, Pet six races + atomicity passed. Logs `hospitality-domain.log`, `hospitality-pricing.log`, `hospitality-shifts.log`, `pet-concurrency.log`.
- Actual browser: earlier desktop/mobile workflow run 52 pass/8 fail/2 skip; eight Core failures diagnosed and fixed. Current four Core tests pass. Date regression old-build reproduction fails; recent failures were strict locator matching Next route announcer; scoped to main content.
- Active browser invocation when checkpoint written: `npm run test:e2e -- e2e/ui-standard.spec.ts e2e/appointment-date-filter.spec.ts --project=desktop-chromium --workers=1 --output=/private/tmp/negosu-full-qa/review-browser-2`, log `review-browser-2.log`. It verifies four verticals' dashboards, staff lists and staff-create dialog at all seven exact widths/heights.
- UI checks found transient duplicate IDs between streamed loading skeleton/content; fixed `app/dashboard/loading.tsx`. Salon uses `salon-staff` ID prefix; Pet direct dashboard route avoids redirect sampling. Fixes must be verified.
- Actual screenshots inspected with view_image: `review-browser/...salon.../payments-320.png` and `...pet.../reports-1440.png`: readable reflow, clear buttons/tabs, no clipping, official logo casing, neutral cards. Report row borders appear darker than shared table tokens; inspect targeted standardization. Do not generalize these two screenshots to all layouts.
- Evidence now in protected per-run folders. Playwright default outputDir fixed so unrelated evidence is retained. Original baseline raw logs under test-results/qa were deleted by old default output cleanup; documentation explicitly acknowledges this.
- Host disk previously filled and paused shared Colima with io-error. Removed only regenerable Next caches, resumed QMP without reset; DB health recovered. About 5 GB free at last check. Monitor before more builds/traces; don't touch unrelated project files.

## Exact next work

1. Read `review-browser-2.log`, reproduce/fix remaining UI/date test failures without dropping assertions; inspect screenshots from all four verticals at required widths.
2. Finish currency review: service form labels/query currency/server creation, individual payment currency, grouped mixed-currency collection metrics. Check financial totals and historical semantics; no historical backfill authorized.
3. Broaden browser suite and run genuine Automotive and Salon end-to-end golden paths, not just Core payment/walk-in samples. Existing Pet/Hospitality paths need final integrated repetition.
4. Complete reusable access fixtures (same-industry tenant pairs for every vertical, branch-restricted manager, staff contacts/login combinations, unassigned and multi-org users). Existing local seeds cover only part of that matrix; rollback SQL fixtures cover more roles but are not reusable browser accounts.
5. Expand source/browser feature and action inventory with explicit method, prerequisites, actor, actual readback evidence and status. Current 99 route/1,220 candidate control entries are discovery, not full verification.
6. Verify append-only migration clean replay including0097; rerun meaningful SQL/RLS/concurrency if changed. Run npm audit including dev dependencies, lint, typecheck, unit tests and build after final code; real health request.
7. Run two consecutive clean critical browser passes on final integrated code at 390×844 and1366×768; any affected code change requires refreshed evidence.
8. Self-review all diffs/new files, update defects/matrix/evidence and this checkpoint. Do not claim readiness while action/golden-path coverage remains incomplete.

## Repeatable local commands

Existing protected runner, from repo root:

```sh
/Users/mardi/.nvm/versions/node/v24.20.0/bin/node /private/tmp/negosu-full-qa/run.mjs npm run qa:seed -- --apply --pet-care
/Users/mardi/.nvm/versions/node/v24.20.0/bin/node /private/tmp/negosu-full-qa/run.mjs node --import tsx scripts/hospitality-seed.ts
/Users/mardi/.nvm/versions/node/v24.20.0/bin/node /private/tmp/negosu-full-qa/run.mjs npm test
python3 /private/tmp/negosu-full-qa/sql-run.py
```

Owner emails and local-only documented password are in `docs/PILOT_QA.md` / existing seed scripts. Automotive and Salon owners enter their single workspace. Pet uses `qa.pet.owner@negosu.local.test`; Hospitality uses `qa.hospitality.owner@negosu.local.test` and selects QA Apartelle & Inn. Hospitality fixture file `/private/tmp/negosu-hospitality-fixture.json` contains synthetic IDs only. No production credentials needed.

For a fresh machine, create a separate Supabase project/config with different ports and replay repository migrations, disable external providers, and set QA_SEED_APPROVED_TARGET_URL to that exact local API before running seeds. Temporary runner/environment files are machine-local prerequisites, not committed deployment tooling.
