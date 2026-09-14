# Billing loading developer report

## Cause and implementation

Read-only checks against the configured database confirmed `plans.is_custom` is missing (42703), and `get_org_entitlements(uuid)` is absent from the API schema cache (PGRST202). Both are introduced by migration `0028_phase11_revenue_phase12_billing.sql`. Base plan and subscription-column reads succeeded. The old page selected newer columns with its base data and treated every failure, including catalog drift, as a whole-page billing failure.

Separated base catalog/subscription reads from provider configuration and entitlements. Readable plans and subscription information remain visible when online billing setup is unavailable. Catalog and subscription errors render independently. Unverified effective entitlements are never synthesized; an existing subscription is labeled Subscription plan when effective access is unavailable. Checkout/portal controls stay unavailable if setup or subscription reads fail. Catalog mismatch disables only the affected plan's checkout and marketing annotations.

## Files

- `app/dashboard/settings/billing/page.tsx`: retains owner-only gate and authenticated organization context.
- `lib/billing/overview.ts`: scoped read loader and isolated availability state.
- `components/billing-overview.tsx`: extracted existing presentation with partial error/setup states.
- `tests/billing-overview.test.ts`: nine new loading/guard regressions.
- `e2e/billing.spec.ts`, `e2e/fixtures/billing.tsx`: actual component/CSS browser checks with synthetic boundaries.
- Updated source-location assertions in four existing UI regression files; updated Billing, Architecture, and Testing documentation.

## Database, domain, and security

No migration, production data, authentication, RLS, subscription mutation, provider operation, or entitlement rule changed. Application reads still use the authenticated Supabase client. Organization filters come from server dashboard context; the entitlement RPC receives the same organization. The service key was used only in the diagnostic process for read-only catalog/schema checks, never added to application billing reads. No customer subscription records were inspected by diagnostics.

The existing migration remains the canonical online-billing setup. No replacement schema or alternate entitlement implementation was introduced. Migration 0028 includes invoice/revenue changes and a data update, so applying it to a hosted or partially migrated database requires schema/history review and the authorized release workflow.

## Validation and self-review

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 310 passed (including nine new regressions).
- `npm run test:e2e -- e2e/billing.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`: 12 passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Reviewed desktop and 320px screenshots, independent errors/empty states, scope filters, retained owner gate, provider interval submissions, and absence of fabricated effective access. Updated two source-based tests that initially failed because presentation moved into its own component; the full suite then passed. No blocking application findings remain.

## Limits and next step

Hosted online checkout remains unavailable until missing billing schema and provider configuration are completed. No hosted migration or deployment was performed. Browser checkout tests mock the server-action boundary; they do not claim a live authenticated checkout or provider payment. Review migration history and schema, apply the missing billing setup through the normal release workflow, then validate authenticated billing in the target environment.
