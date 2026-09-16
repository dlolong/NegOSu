# Developer report: PayMongo account upgrades

## Implementation

Added shared owner-only plan review, monthly/yearly prepaid checkout, payment status, resume/cancel, and tabbed payment history for Automotive, Salon, and Pet Care. Added signed webhook verification, provider reconciliation, exactly-once activation, manual renewal, remaining-value upgrade credit, and expiry to Free. Existing Stripe billing and customer-service payments remain separate and preserved.

Main files/modules: `app/dashboard/settings/billing/`, `app/api/billing/paymongo/`, `lib/billing/paymongo*.ts`, `components/billing-overview.tsx`, `components/billing-payment-refresh.tsx`, environment validation, and `docs/PAYMONGO.md`.

Database: append-only migration `0083_paymongo_plan_upgrades.sql` introduces owner-readable billing orders, service-only provider attachment/activation, prepaid subscription value, and time-aware effective entitlements. It was applied and exercised locally; it has **not** been applied to the hosted database. Pending dependencies must be applied in order.

Security review: prices and entitlements remain database-authoritative; all owner operations resolve the active organization server-side. RLS prevents staff/cross-tenant order reads and direct writes. Provider callbacks require valid raw-body signatures and independent session verification. Exact amount/currency/reference/mode checks, unique payment IDs, one-open-order constraints, and transaction locks protect activation. Checkout redirects are restricted to PayMongo. No secrets or raw provider payloads are returned to the browser.

## Validation performed

| Command/check | Result |
| --- | --- |
| `npm test` using Node 24 and isolated local environment | 384 passed |
| `npm run check` (`lint`, `typecheck`, `build`) | Passed |
| Local pgTAP `paymongo_billing.sql` | 50 assertions passed |
| Local pgTAP `phase12_billing_entitlements.sql` | 22 assertions passed |
| Local pgTAP `reports_every_plan.sql` | 49 assertions passed |
| Local pgTAP `phase11_reporting.sql` | 20 assertions passed |
| Local pgTAP `shared_appointment_reporting.sql` | 16 assertions passed |
| Playwright `paymongo-upgrades.spec.ts`, `billing.spec.ts`, `reports-plans.spec.ts`, desktop Chromium, one worker | 10 passed |
| Responsive checks/screenshots | 320px and 1440px review pages; 320px payment status/history; checked visually |
| Real PayMongo test API create/retrieve/expire | Passed; no payment charged |
| `git diff --check` | Passed |

New tests exercise concurrent checkout creation, simultaneous/replayed signed confirmations, forged success redirects, missing webhook recovery through owner refresh and the scheduled endpoint, cancellation, renewal/annual quote, upgrade credit, filter tabs, and tenant/role restrictions. The browser provider boundary is an explicitly guarded local fixture; application auth, actions, routes, database and RLS are real local components.

## Self-review findings and fixes

- PayMongo v2 returns a short creation response: parse it separately, retrieve the full session for verification.
- Duplicate/stale/null confirmations: database checks reject mismatches and prevent duplicate access or overwriting unrelated subscription changes.
- Provider idempotency expires: stop uncertain creation retries after 23 hours and present support review.
- Paid hosted checkouts: expire after activation and retry failed closure through reconciliation.
- Cancellation races: verify before and after expiry; never remove paid access.
- Mobile history squeezed the plan name: hide the separate status column on phones and show status with the plan.
- History tabs used the wrong query parameter: corrected and added browser assertions.
- Existing Stripe actions had unreadable code and ignored subscription read errors: formatted, removed duplicate reads, and fail closed with controlled errors.
- Existing static authorization test assumed minified spacing: made its owner-check pattern whitespace-insensitive, retaining both required checks.

No unresolved blocker or high-severity finding in the tested scope. The local Next server emitted occasional “destination stream closed early” diagnostics during browser navigation; all final route and browser assertions passed.

## Remaining deployment work and limits

Use [the setup guide](../PAYMONGO.md) to apply migration 0083 with its dependencies, register the public HTTPS webhook, configure enabled merchant payment methods/live keys, and schedule reconciliation. No production deployment, hosted schema mutation, live charge, or external webhook registration was performed.

Actual externally delivered PayMongo webhook/live-money acceptance remains unverified here. Automated refunds/disputes, automatic recurring subscriptions, and a platform support console are outside this prepaid upgrade flow. Stale or uncertain payments have a documented support recovery path rather than a second charge.

## Follow-up: organized PayMongo descriptions

Added migration 0084 and extended `lib/billing/paymongo.ts` to send a saved business/plan/term/purchase-type/order-reference description, with a TEST prefix for test payments. Structured metadata includes organization, plan, interval, and purchase type. Descriptions are normalized, bounded, and snapshotted by a database trigger; existing orders retain their original payload for retry compatibility. RLS and payment authorization are unchanged. No app UI changes were needed.

Updated PayMongo unit and database regressions cover provider fields, identical retry payloads, legacy payload compatibility, authorization, business renames, and yearly upgrades. Validation: `npm test` (385 passed), local `paymongo_billing.sql` (54 assertions passed), `npm run check` (lint/typecheck/build passed), and `git diff --check`. A real PayMongo test-mode create/retrieve confirmed description and metadata persistence; that unpaid checkout was then expired successfully. No live charge or hosted database change was made.

Self-review found no unresolved blocking issue in this change. Hosted setup now requires migration 0084 after 0083; existing PayMongo transactions are not retroactively relabeled. See the updated setup guide for the format and rollout instructions.

## Follow-up: cancellation failure

Read-only diagnostics confirmed that the hosted schema lacked `checkout_closed_at` and `last_checked_at`. The affected unpaid provider session was already expired while its NegOSu order remained pending: the status write failed because it included the missing closure column.

Updated `paymongo-actions.ts` and `paymongo-server.ts` so cancellation/expiry persist their terminal status independently of reconciliation tracking. Provider verification, owner/tenant checks, conditional status updates, and paid-plan protection are unchanged. Added append-only migration 0085 to safely restore the missing tracking fields without touching payment data or RLS.

Validation: `npm test` (385 passed), `npm run check` (lint/typecheck/build passed), repair pgTAP regression (7 assertions passed), and two browser regressions for active and already-expired unpaid checkouts. The browser tests ran against the isolated local database with both tracking columns temporarily renamed out of the schema, reproducing the hosted failure; columns were restored afterward. Both cancellations succeeded and subscriptions stayed unchanged. `git diff --check` passed. Self-review found no unresolved blocker in cancellation.

Hosted reads only were performed; no hosted schema or payment data was changed. The current cancellation can be retried through the owner page. Migration 0085 remains necessary on the hosted database for scheduled reconciliation and paid-checkout closure tracking. These were diagnosed as blocked by the schema gap and have a tested repair; the repair was not applied remotely.
