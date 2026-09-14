# Billing operations

## Launch catalog contract

`modules/platform/plan-catalog.ts` is the single customer-facing launch catalog used by both `/plans` and authenticated Billing presentation. It defines the public plan names, Philippine-peso prices, summaries, and honest plan highlights. The database remains authoritative for subscription state, provider configuration, and entitlement enforcement.

Authenticated Billing compares each active database plan with this launch catalog before enabling its checkout. A name, price, annual price, or custom-plan mismatch disables checkout for that plan and suppresses launch marketing annotations; it does not hide the subscription or other plans. Displayed prices come from the database. Changes to launch pricing therefore require one coordinated change to the catalog, append-only database migration, and Stripe Prices. The launch regression test verifies the seeded database values match the shared catalog.

The `monthly_jobs` entitlement currently applies to Automotive Job Orders. Public cross-industry highlights do not describe that value as a Salon Appointment limit, and Salon Billing omits the Automotive-only Job Order count. Public cards list only universal shared concepts or qualify additional capabilities by industry; they do not promise Automotive-only reports, payments, or booking-request workflows to Salon businesses. Authenticated Billing uses `visiblePlanFeatureLabels()` to translate enabled database keys into customer-readable, industry-supported capabilities: Salon may show Appointment reminders, Automotive may show Maintenance reminders and Advanced Automotive reports, and the historical `ai` flag stays hidden until a launch-ready workflow exists.

ServiceCore uses Stripe-hosted Checkout and Customer Portal behind the `BillingProvider` interface. Browser redirects never grant access. Entitlements change only after a signed Stripe webhook or authenticated server reconciliation updates the subscription through the service-role-only database RPC.

## Production configuration

1. Create recurring monthly and yearly Stripe Prices for Starter, Business, and Pro.
2. Set `plans.provider_monthly_price_id` and `plans.provider_yearly_price_id` to those Price IDs. Price amounts in Stripe must match the corresponding NegOSu launch catalog before launch.
3. Set server-only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `BILLING_RECONCILIATION_SECRET` of at least 24 characters.
4. Register `POST /api/billing/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created`, `updated`, and `deleted` events.
5. Configure Stripe Customer Portal products, allowed changes, cancellation behavior, and branding.
6. Schedule `POST /api/billing/reconcile` with `Authorization: Bearer <BILLING_RECONCILIATION_SECRET>` and alert when `failed` is nonzero.

Use Stripe CLI forwarding and test-mode products before production. Never put secret keys or webhook secrets in `NEXT_PUBLIC_*` variables.

## Access behavior

- `trialing` and `active` subscriptions receive their selected plan.
- `past_due` receives a seven-day grace period, then safely falls back to Free access.
- `cancelled` and `paused` fall back to Free access.
- Downgrades prevent new over-limit resources but never delete branches, staff, jobs, photos, or history.
- Only owners can view subscription state or launch billing management.

## Billing read availability

`lib/billing/overview.ts` loads the base catalog/subscription separately from provider configuration and `get_org_entitlements`. Missing provider columns or RPCs must not hide readable billing information. Catalog and subscription errors have separate recovery states. Checkout and portal controls remain unavailable when setup or subscription reads fail. Effective access is displayed only from the entitlement RPC; when unavailable, existing subscription data is labeled Subscription plan instead of inventing effective entitlements.

The provider columns and entitlement RPC require `0028_phase11_revenue_phase12_billing.sql`. Verify migration history and schema together before applying pending migrations in order through the release workflow. Do not blindly rerun this migration on a partially migrated database: it also changes invoice/revenue behavior and contains a data update. Plan viewing can work without online billing; checkout still requires the canonical billing schema and configured provider prices/credentials.
