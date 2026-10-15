# Public page color themes

Date: 2026-10-15

## Implementation and files

Owners and managers can select Classic, Steel Blue, Plum, Teal, Graphite, or Indigo in Settings → Website and booking (Public website for hospitality) → Business details → Color theme. Swatches, live preview, keyboard navigation, cancel, pending submission, and save feedback are included. Themes are free on every plan for now; no theme paywall or billing change was introduced.

- `modules/platform/public-page-theme.ts`: public theme allowlist, original-look fallback, and reuse of existing palette definitions.
- `components/public-page-theme-form.tsx`: responsive selector and preview.
- `app/dashboard/settings/public-page/{page.tsx,actions.ts}`: load and permission-checked save.
- `app/shop/[slug]/layout.tsx`, `lib/public-booking.ts`: server-rendered public theme across storefront, booking, queue, product details, and basket routes.
- `app/globals.css`, `app/shop/[slug]/page.tsx`: scoped shared palettes and neutral hero text.
- `supabase/migrations/0136_public_page_themes.sql`: persisted setting and public projection.
- `tests/public-page-theme.test.ts`, `e2e/public-page-themes.spec.ts`, `e2e/fixtures/public-page-themes.tsx`, `supabase/tests/public_page_themes.sql`: validation coverage.

## Database, business rules, and security

Migration 0136 adds `organizations.public_page_theme`, non-null with default `classic` and a six-value CHECK constraint. Existing rows retain the original palette. The existing `get_public_shop` projection gains only `theme`; its tenant joins, active-branch restrictions, public-catalog filters, publication/status checks, and other fields are preserved. No RLS policy is changed.

The server action requires the existing `public_website` feature and `settings.manage` permission, validates the theme against the allowlist, resolves the organization from authenticated context, and updates only that organization's theme through the authenticated Supabase client. Existing organization RLS independently restricts updates to active owners/managers. Submitted organization IDs and unrelated profile fields are ignored. Errors are sanitized. No service-role client or arbitrary CSS is used.

Repeated saves are harmless; simultaneous theme edits use last-write-wins. Updating only the theme prevents overwriting concurrent profile edits. The theme is organization-wide across locations; existing branch visibility rules are unchanged. Dashboard preferences remain independent. Unknown or missing public theme values fall back to Classic. Existing page publication rules are unchanged.

## Validation performed

Node 24.20.0 was used.

- `npm run lint`: passed after fixing a test-harness variable name flagged by ESLint.
- `npm run typecheck`: passed.
- `npm run build`: passed. Turbopack initially could not bind its compiler port inside the sandbox; the authorized rerun outside it succeeded.
- `npm test`: passed, but its existing shell glob selected only two nested tests in this environment.
- `node --import tsx --test tests/*.test.ts tests/**/*.test.ts`: all 589 tests passed, including new action-boundary tests for role denial, invalid input, authoritative tenant scope, retries, sanitized errors, and cache refresh.
- `npx playwright test e2e/public-page-themes.spec.ts --project=desktop-chromium` with installed Chrome and fixture-only `E2E_BASE_URL`: three browser tests passed at 1440px, 390px, and 320px. Checks cover every palette, preview isolation from dashboard colors, keyboard selection, cancel, submitted value, duplicate-submission prevention, refreshed saved preference, and no horizontal overflow. These are component integration tests with a simulated save boundary, not a live authenticated database workflow.
- `git diff --check`: passed.
- Compared the replaced public RPC body against migration 0119: identical except the added theme field.

## Self-review, risks, and next step

Reviewed schema constraints, RLS preservation, server authorization, public filtering, fallback behavior, CSS scope, error handling, and desktop/mobile layout. No known BLOCKER or HIGH code findings remain. The browser fixture refreshes the saved preference to model the actual server redirect.

Database execution remains unverified: the local Docker database daemon was unavailable. The rollback-only pgTAP suite covers free-plan saves, default/invalid/null themes, retries, owner/manager access, viewer/inactive-member denial, cross-tenant denial, anonymous denial, publication/status gating, and RLS remaining enabled. Run it and the existing public product/branding suites on a local/test database before rollout.

Apply migration 0136 before deploying the application change; settings now query the new column. No database was migrated and nothing was deployed. Paid-plan gating is deferred as requested. Private token pages outside `/shop/[slug]` retain their existing appearance.

After local database validation, use the normal reviewed release process and smoke-test an authenticated save followed by an anonymous storefront and booking visit.
