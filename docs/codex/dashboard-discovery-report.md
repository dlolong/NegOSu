# Dashboard website and feature discovery

## Implementation

- Added a public website card to the main and pet-care dashboards, displaying publication status and the full address. Published addresses open the public website; owners and managers receive a website settings shortcut.
- Added up to three compact feature previews using existing industry navigation and role permissions. Hospitality receives relevant previews without advertising unsupported public booking pages.
- Existing technician and hospitality staff routing is preserved.
- The card distinguishes published, unpublished, inactive-account, and unavailable-status states. Long URLs wrap on small screens; controls have semantic IDs and external links announce their new tab.

## Files

- `components/dashboard-discovery.tsx`: server-side tenant-scoped status lookup.
- `components/dashboard-discovery-content.tsx`: shared presentation.
- `lib/dashboard-discovery.ts`: publication summary and permitted preview selection.
- `app/dashboard/page.tsx`, `app/dashboard/pet-care/page.tsx`, `components/hospitality/overview.tsx`, `components/command-center/command-center.tsx`: dashboard integration.
- `tests/dashboard-discovery.test.ts`, `e2e/dashboard-discovery.spec.ts`, `e2e/fixtures/dashboard-discovery.tsx`: regression coverage.

## Database, business rules, and security

No migrations, mutations, RLS changes, or business-rule changes. Organization status is read through the authenticated Supabase client with an explicit organization ID from server-resolved membership. Publication status matches the existing public shop RPC: active organization and publication enabled. Links use the configured application origin. Existing destination authorization remains authoritative.

## Validation and self-review

Executed with Node 24:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `node --import tsx --test tests/*.test.ts`: 464 passed, including four new tests covering publication states, URL encoding, role restrictions, and vertical capabilities.
- `npm run build -- --webpack`: passed.
- `git diff --check`: passed.
- Browser fixture bundle and Tailwind CSS compilation via `renderFormFixture`: passed.

Reviewed tenant scoping, unchanged route permissions, lookup failure handling, empty previews, semantic IDs, mobile URL wrapping, and desktop layout. No blocking findings identified. Browser assertions were added for links, unpublished/unavailable states, restricted roles, and overflow, but not executed because browser execution was previously declined in this session. Compilation is not a visual or browser-test pass.

## Remaining validation

Run `npm run test:e2e -- e2e/dashboard-discovery.spec.ts` when browser execution is available, then check the dashboard on a phone and desktop using an existing test business. Confirm `NEXT_PUBLIC_APP_URL` matches the intended customer-facing deployment address. No production changes or deployment performed.
