# Developer report: Apartelle plan upgrades and shift staff

## Implementation

Owners now have an Apartelle Overview **Upgrade plan** action and a main-menu **Billing & Plan** entry. These use the existing monthly/yearly PayMongo review, checkout, history and verified plan activation. Apartelle can review a valid plan even if online checkout is unconfigured; actual payment remains unavailable until provider readiness checks pass. Configured Stripe checkout is preserved. Public pricing copy includes Apartelle & Inn.

New check-in and checkout forms require searchable cashier and housekeeper selections from active Core Staff profiles eligible for the current branch. Staff do not need logins or contact details. Job functions are searchable descriptions; they do not grant permissions. Each event retains its own selected staff and name snapshots. Stay details and statements show both shifts. Financial actions still record and authorize the actual logged-in user.

## Files and database

- `0096_hospitality_shift_staff.sql`: operational staff-event table with tenant/branch foreign keys, RLS and read-only authenticated access; private attribution helper; atomic shift-aware check-in/checkout RPC wrappers.
- Hospitality actions, runtime, check-in/checkout forms, room/stay/statement pages, shared shift staff fields and Overview.
- Main-menu navigation/icon and shared billing plan-review routing; public plan description.
- Hospitality unit/browser tests and new guarded local `scripts/test-hospitality-shifts.ts`.
- Hospitality/deployment/permissions documentation and bounded phase plan.

Previous pricing/deposit changes in the working tree were preserved. Migration 0096 applied successfully to the local development and replay databases. No earlier migration was rewritten. No hosted data/schema change, deployment, provider session or real charge occurred.

## Business rules and security

Staff selection is separate from authentication. Only existing authorized roles can collect money or refund a deposit. Selected profiles must belong to the business, be active and be eligible for the current branch; unassigned profiles follow Core's all-branches convention. The same staff member may cover both duties. Branch restrictions apply to the authenticated user independently.

The selected arrival and departure staff are immutable event snapshots. Exact duplicate requests return the original event, including after staff rename/deactivation; changed selections on an already completed event are rejected. Staff validation failures roll back the entire check-in or checkout, including money, occupancy and cleaning changes. Existing room/stay/invoice locking and request serialization are reused. Internal attribution writes cannot be called directly by authenticated users.

Earlier stays and old client RPCs remain usable without fabricated attribution; the new UI labels absent history explicitly. This compatibility does not relax payment or branch permissions. Checkout's housekeeper identifies the shift assignment; the existing Mark ready action separately records the authorized user confirming cleaning.

## Validation and self-review

- `npm test`: 398 passed.
- `npm run check`: lint, typecheck and production build passed.
- `scripts/test-hospitality-shifts.ts`: 22 local integration checks passed, covering required selections, cross-tenant/branch and inactive staff rejection, independent staff without login, exact retries, actual concurrent submissions, preserved name snapshots, failed-checkout refund rollback, role enforcement, immutable history, monthly/yearly quotes, idempotent pending orders and no activation before payment confirmation.
- Existing pgTAP `paymongo_billing.sql`: 54 passed; `staff_profile_login_decoupling.sql`: 54 passed.
- Hospitality browser suite: 20 passed across desktop and 320/390-pixel mobile layouts; four duplicate desktop-only scenarios skipped. Includes distinct arrival/departure staff, existing payments/deposits/cleaning, monthly/yearly upgrade review, cancellation and responsive dialogs.
- Final-build billing rerun: 3 passed across desktop and both mobile sizes after the Stripe-fallback self-review fix.
- Desktop/mobile screenshots inspected; no page overflow detected. Existing dialog background scroll locking and Close/Cancel behavior remain covered.
- `git diff --check`: clean.

Self-review covered RLS/grants, tenant foreign keys, profile branch scope, authoritative actor versus selected staff, snapshots, failed-transaction rollback, retries and provider fallback. Fixed the plan-review change to preserve configured Stripe checkout and keep the unconfigured-provider review fallback specific to Apartelle. No known unresolved blocker/high finding.

## Rollout and limits

Apply reviewed migration 0096 after pricing migrations 0093–0095 before deploying the new forms. The owner should add active staff and configure branch assignments in Staff. Existing PayMongo credentials/webhooks are still needed for real checkout; no secrets were changed and real provider payment was not exercised.

No scheduling/timeclock, payroll, historical staff backfill or reassignment of a completed event is included. Production rollout remains an authorized operator action. Next occasionally logs its existing “destination stream closed early” navigation-cancellation message during automated browsing; browser assertions and transaction checks pass.
