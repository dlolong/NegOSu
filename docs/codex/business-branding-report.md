# Business identity implementation report

Date: 2026-09-14

## Implementation

Business names and logos now lead in the authenticated desktop/mobile shell, organization choices, business setup, storefront, booking form/status, appointment management, estimate approval, and queue displays. A small “Powered by NegOSu” attribution replaces the large platform mark on these surfaces. The Command Center identifies the active business. Marketing and shared authentication retain platform branding.

The shared identity component supports absent, invalid, and failed image URLs with business initials and name. Long names are bounded. Mobile branch controls moved into the user menu to preserve room for business identity at 320px.

Owners and managers can preview, save, or remove their logo in Settings → Profile and workspace → Business identity. Existing public-page settings edit the same `organizations.logo_url` field. This implementation accepts public image URLs; file uploads and custom domains are outside scope.

## Principal files

- `components/business-identity.tsx`, `components/powered-by.tsx`, `components/business-branding-form.tsx`: shared presentation and settings preview.
- `modules/platform/business-branding.ts`: logo URL validation, initials, and business metadata.
- `lib/auth/context.ts`, `components/app-shell.tsx`, `app/dashboard/settings/*`: authenticated identity and permission-checked logo save.
- `lib/public-business.ts`, `app/shop/[slug]/*`: request-cached, anonymous public-business loading and owned storefront metadata.
- Customer booking, appointment, estimate, and queue pages; their existing DTOs and queue service: business identity presentation.
- `public/images/business-favicon.svg`: neutral fallback icon.
- Branding, product-entry, public-data-contract, and testing documentation: updated behavior and rollout instructions.

## Database and business rules

Append-only migration `0068_business_branding.sql` adds `logoUrl` to four existing public JSON projections: booking status, Salon appointment self-service, public Salon queue, and the estimate's business object. No new table/column or RLS policy is required. Historical migrations were not modified.

The business context resolves on the server. Logo updates require `settings.manage`, use the authenticated Supabase client, and filter by the active organization ID. Existing RLS remains authoritative. Publication, token, expiry, revocation, and branch checks are preserved. The change does not alter financial, scheduling, or workflow rules.

Remote images load directly in the browser without the server image optimizer. Image requests and owned-page metadata use no-referrer behavior. Invalid/executable/credential-bearing logo URLs do not become image sources. Old RPC payloads remain supported through name/initial fallback.

## Validation

All checks used Node 24.20.0.

- `npm test`: 282 passed, including five new branding tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run release:env`: passed in development mode.
- `npm run build`: passed after removing the temporary browser-preview route.
- `git diff --check`: passed; because most repository files are currently untracked, modified/new files were also compared against a pre-edit snapshot.
- Migration executed successfully in an isolated copy of the local development database. The local history ledger lagged its actual schema; the clone required migrations 0066/0067 before testing 0068. The existing local database was not reset or migrated.
- Five SQL suites ran with `psql -X -v ON_ERROR_STOP=1`, and their TAP output was checked for failures: business branding (13), public Salon queue (28), public Salon booking (68), Salon vertical (74), and estimate approval (47). All 230 assertions passed. Coverage includes tenant isolation, roles, inactive membership, publication gating, valid/invalid private tokens, and business-specific logo projections.
- Ten scripted Chrome scenarios passed using real shell/identity/form components with synthetic memberships at 1440px, 390px, and 320px: logo loading, failed/missing logo fallback, changed business identity, preview edits, readable business names, mobile branch-menu controls, and no horizontal overflow. Desktop/mobile screenshots were visually reviewed. This was component integration validation, not a hosted login/save test.

## Self-review findings and fixes

- Fixed mobile branch controls crowding the business name; verified menu access and readable identity at 320px.
- Updated the public queue allowlist assertion for the one new logo field.
- Kept private-link branding behind existing validated projections, with optional fields during rollout.
- Updated both settings save paths to refresh workspace and public-page data.
- No unresolved blocking findings were found in this change.

## Rollout and limits

The hosted database was not changed and the application was not deployed. Apply the reviewed `0068_business_branding.sql` migration in the target environment through the normal migration workflow for logos on private customer links and the public queue. The workspace and storefront reuse the existing logo column. Older projection responses continue showing the business name/initials.

External logo availability depends on its hosting URL; failed images fall back safely. A real authenticated save and customer-page smoke check should follow the authorized target-environment rollout. No live customer communication, payment, or production backfill was performed.
