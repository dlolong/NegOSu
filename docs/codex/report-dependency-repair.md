# Hosted reporting dependency repair

The Automotive error `reports.entitlements / PGRST202` was verified against the configured hosted database on 2026-09-16. Migration 0081's reporting functions and Starter feature flag exist, but prerequisites originally introduced in 0028 do not:

- `get_org_entitlements`, `effective_entitlements`, and `has_entitlement`.
- `organization_subscriptions.grace_ends_at`.
- Invoice line fields for job-item/service/category snapshots and recognized revenue.

Migration `0082_restore_report_dependencies.sql` restores these canonical reporting dependencies, the invoice allocator, and invoice issuing with revenue snapshots. It recomputes derived invoice-line allocations only where their sum does not match the invoice total. Invoice totals, balances, and payments are unchanged. Historical categories without snapshots remain Uncategorized. No RLS policy changes or plan/price changes are included. The PostgREST schema cache is reloaded at the end.

The page and CSV route now use safe operation/code diagnostics so a failure is observable without exposing business data. They continue to fail closed when access cannot be determined.

## Validation

- A rollback-only local SQL fixture removes the same dependencies, applies 0082, validates restored access, reconciled historical allocations, new invoice issuing, cross-tenant/anonymous denial, and repeat application: 16 assertions passed.
- Existing report/plan/billing SQL suites: 107 assertions passed after applying 0082 locally.
- `npm test`: 377 passed.
- `npm run check`: lint, typecheck, and build passed using isolated local environment settings.
- Browser suite `e2e/reports-plans.spec.ts`: all 3 industry tests passed after repair, covering Free, Starter, cancellation, CSV access, and responsive layouts.
- Self-review and `git diff --check` completed. Hosted execution remains the outstanding blocker; no hosted data was modified.

## Required hosted step

Apply the complete migration `supabase/migrations/0082_restore_report_dependencies.sql` through the normal database release workflow, or in the configured project's Supabase SQL Editor, then refresh Reports. This session has a service API key but no SQL/management connection, so the hosted repair has not been executed. The hosted page remains blocked until this step is complete. Other missing 0028 billing-provider configuration fields are outside this reporting repair; they are not required by Reports.
