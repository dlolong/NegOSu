# PayMongo account plans

Owners use **Settings → Billing** to choose a plan, review a monthly or yearly amount, and continue to PayMongo's hosted checkout. Payment details return to NegOSu, with check/resume/cancel actions and a separate **Payment history** table. This shared flow supports Automotive, Salon, and Pet Care. It does not change payments collected from the business's customers.

## PayMongo descriptions

New checkouts include a saved description, for example:

`NegOSu | Example Salon | Business | Monthly | Upgrade | Ref: <order UUID>`

Test checkouts start with `TEST |`. The business name, plan, term, purchase type and full reference help identify the checkout in PayMongo. Structured metadata also carries the organization ID, plan ID, billing interval and purchase type. Names are normalized and bounded; no customer contact details are included.

Apply migration `0084_paymongo_payment_descriptions.sql` after 0083. Descriptions are snapshotted when the order is created, so renaming a workspace cannot change an idempotent retry. Existing orders retain their original payload and are not retroactively relabeled. This uses PayMongo's [checkout description and metadata fields](https://docs.paymongo.com/reference/checkout-session-resource).

## Payment rules

- Each checkout is a one-time PHP payment. There is no automatic debit or recurring subscription.
- Database plan prices determine the amount. Only Starter, Business, and Pro are purchasable; custom plans remain a sales conversation.
- The owner reviews the price and accepts the payment terms. If the saved checkout has a different price, the owner must review it again before continuing.
- A same-plan renewal adds a calendar month/year after existing access. A higher-plan purchase starts its new term at confirmation and converts unused paid value into extra time at the new rate. Quotes show an estimated end date; confirmation determines the final date.
- Unused value is the remaining fraction of the existing prepaid period, rounded down to a centavo. Renewal combines that remaining value with the new payment for future upgrades.
- Active plans cannot be downgraded mid-term. After expiry, effective access becomes Free without deleting business data or depending on a scheduled job.
- An active subscription managed by another provider must be managed before switching to PayMongo. Existing Stripe checkout and portal support remain available.
- Only one unfinished payment may exist per workspace. Multiple tabs reuse it. A signed callback and provider lookup verify the session, reference, payment, currency, amount, and mode. A success URL cannot grant access.
- Cancellation first checks for a completed payment, closes the provider checkout, then checks again. Paid access is never removed by cancelling an unpaid checkout.
- A payment arriving after cancellation or after an unrelated subscription change is recorded as **Needs review**. It does not silently overwrite access. The owner is told not to pay again.

## Database and configuration

Apply pending migrations in order through `supabase/migrations/0085_restore_paymongo_recovery_columns.sql`. Install 0082 first if the reporting/entitlement dependency repair is still pending. Migration 0083 adds `billing_orders`, subscription prepaid-value/interval fields, provider configuration columns where missing, and owner/service-only RPCs. It updates entitlement expiry behavior. Existing subscriptions and service payments are preserved.

Set these server environment variables (see `.env.example`):

| Variable | Use |
| --- | --- |
| `PAYMONGO_SECRET_KEY` | `sk_test_…` in development; `sk_live_…` for production |
| `PAYMONGO_WEBHOOK_SECRET` | Signing secret for the registered checkout webhook |
| `PAYMONGO_PAYMENT_METHOD_TYPES` | Comma-separated methods actually enabled on the merchant account; default `gcash,qrph,card` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only verified payment processing |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin for return URLs; HTTPS for deployed environments |
| `BILLING_RECONCILIATION_SECRET` | At least 24 characters, used by the optional recovery schedule |

Never expose secret keys through `NEXT_PUBLIC_` variables. `npm run release:env -- --production` rejects PayMongo test keys in production. Follow the existing release validation workflow for deployments that do not invoke `npm start`.

In the PayMongo dashboard, register:

```text
POST https://YOUR_APP_DOMAIN/api/billing/paymongo/webhook
Event: checkout_session.payment.paid
```

Use the matching test/live webhook signing secret. The endpoint verifies the raw body, signature timestamp (five-minute tolerance), and mode, then independently retrieves the provider session before applying payment. Keep server clocks synchronized. Configure enabled payment methods before going live.

Schedule an authenticated request every few minutes for recovery if a webhook is missed:

```text
POST https://YOUR_APP_DOMAIN/api/billing/paymongo/reconcile
Authorization: Bearer YOUR_BILLING_RECONCILIATION_SECRET
```

Each run checks up to 20 known open sessions or confirmed payments whose hosted checkout still needs closing, oldest check first, in batches of five. Allow at least a two-minute execution window, or invoke more frequently on smaller queues. HTTP 207 reports partial provider failures; retry on the next schedule. The status page also checks payment automatically for one minute and offers a manual check afterward. Scheduling improves recovery but is not needed to expire plan access.

## Recovery and support

If cancellation previously showed “Could not confirm cancellation” after PayMongo had already expired an unpaid checkout, an initial installation may lack `checkout_closed_at` and `last_checked_at`. Migration 0085 safely adds these tracking columns without changing payments. Cancellation and expired-status updates now save only their terminal status and do not depend on those optional tracking fields. Owners can reopen the payment and retry Cancel, or use Check payment to recognize an already expired checkout. Apply 0085 to restore the scheduled reconciliation endpoint and paid-checkout closure tracking too.

Use the order reference shown to the owner to locate the `billing_orders` row and the PayMongo checkout's `reference_number`. Provider failures are logged as `billing.paymongo.*` with safe diagnostic codes; credentials and raw payment payloads are not logged.

Paid/review orders retain their provider payment ID; repeated confirmation is idempotent. After verified payment, the hosted checkout is closed. If closure fails temporarily, reconciliation retries without charging or extending access again.

If checkout creation was interrupted before its session ID was saved, Resume retries with the original idempotency key for at most 23 hours from order creation. PayMongo's keys expire after 24 hours, so older uncertain creation requests require support review and are never silently recreated. Match the order reference in the PayMongo dashboard before attaching the original session or cancelling the request through an authorized service operation. If there is no session or payment, verify that fact before cancelling the database order. Never mark an order paid based on a screenshot or a return URL.

For **Needs review**, check the actual PayMongo payment and current subscription together. Resolve access or refund through an explicitly authorized support operation; automated refunds, disputes, and a platform support console are outside this account-upgrade flow. Do not delete payment records as a recovery shortcut.

## Validation

- `npm test`: provider API response shape, idempotency headers, redirect allowlist, signature integrity/timestamp/mode, exact payment matching, controlled errors, and environment validation.
- Run `supabase/tests/paymongo_billing.sql` against an isolated local database with pgTAP: 54 assertions covering roles/RLS/tenant boundaries, prices, retries, entitlement activation, expiry, annual upgrade credit, renewal, stale/cancelled payments, and legacy provider overlap. The fixture rolls back.
- `e2e/paymongo-upgrades.spec.ts` runs the complete owner flow for all three industries, concurrent order creation and webhook delivery, forged return URLs, delayed webhook recovery, cancellation, tabs, and 320/1440px layouts. The test provider intercepts only the server's PayMongo HTTP boundary; auth, routes/actions, SQL, and RLS remain real local services.

To run the browser integration, use your existing isolated Supabase/QA environment and start the built app with these additional **test-only** settings:

```sh
NEGOSU_PAYMONGO_FIXTURE=local-only \
PAYMONGO_SECRET_KEY=sk_test_localfixture \
PAYMONGO_WEBHOOK_SECRET=local-fixture-webhook-secret \
BILLING_RECONCILIATION_SECRET=local-fixture-reconciliation-secret \
NODE_OPTIONS='--import ./e2e/fixtures/paymongo-provider.mjs' \
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3105
```

Then run `NEGOSU_PAYMONGO_FIXTURE=local-only npx playwright test e2e/paymongo-upgrades.spec.ts --project=desktop-chromium --workers=1` with `E2E_BASE_URL`, local Supabase keys, and seeded QA credentials. The preload refuses nonlocal databases and any real provider key. Never set these fixture variables or preload on a deployed service. QA subscription changes are restored afterward; test payment audit entries remain in the local database.

Real PayMongo test-mode create, retrieve, and expire requests were also exercised. No real payment was charged. A live-money transaction and actual externally delivered webhook remain deployment acceptance checks after merchant configuration.

API references: [hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout), [retrieve checkout](https://docs.paymongo.com/re/reference/get_checkout_sessions), [idempotent requests](https://docs.paymongo.com/reference/idempotent-requests), [checkout states](https://docs.paymongo.com/docs/payment-channels-key-concepts), and [webhook setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).
