# PayMongo account upgrades

Goal: owners of every industry can review a monthly/yearly plan, pay through PayMongo, track payment status and history, and receive the purchased access only after verified payment.

Reuse: existing plan catalog, organization subscriptions/effective entitlements, owner authorization, billing page, shared form/table components, and server error diagnostics. Keep existing Stripe subscriptions and portal working; prevent overlapping providers.

Scope: hosted PayMongo checkout with prepaid month/year access, manual renewal, review/status/history pages, signed webhook, safe reconciliation, and payment audit records. No card entry/storage within NegOSu. Provider settings and test/live mode remain server-only.

Database: append-only migration 0083 introduces organization billing orders and narrowly scoped RPCs. Owners can read their own organization's orders; only service role can store provider confirmations and activate subscriptions. Resolve plan/price/currency server-side. Serialize open orders and subscription updates; payment and event identities are unique. Expired prepaid subscriptions resolve to Free without requiring a scheduler.

UX/business rules: show amount, billing term, test mode, and manual renewal before checkout. Preserve remaining paid value on a higher-plan upgrade as additional access at the new plan's rate; show the estimated access end before payment. Same-plan renewals extend existing access. No mid-term downgrades or overlapping active Stripe upgrades. Keep one unfinished checkout per organization; provide resume/check/cancel actions and distinguish pending, paid, cancelled, failed and payment-needs-review states.

Security: owner checks and organization scope on all routes/actions/RPCs, RLS on billing orders, signed raw-body webhook, server-fetched checkout verification, exact amount/currency/reference/session/live-mode validation, idempotent activation, safe redirects, no browser-authoritative payment status, no provider secrets/raw payloads in UI/logs. No live charges, webhook registration, production schema changes or deployment automatically.

Validation: provider/signature/quote unit tests, SQL role/tenant/price/idempotency/concurrency/expiry tests, local browser checkout/status/history/mobile flows with a fake provider boundary, existing billing/report tests, lint/typecheck/build. Exercise PayMongo test mode only if suitable test credentials are configured. Document all remaining external setup.
