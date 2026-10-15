# Industry-specific public page styles

Date: 2026-10-15

## Goal and bounded plan

Extend the existing public storefront and theme administration with opt-in industry styles: Salon → Elegant, Automotive → Precision, Hospitality → Retreat, Pet Care → Friendly. Keep Standard as the default, keep appearance free, preserve the existing horizontally scrolling service/product/promo cards, and exclude testimonials.

Reuse existing authenticated settings, public business RPC, cover/logo fields, theme tokens, catalog rows, booking routes, contact information and maps. Add a constrained presentation preference and bounded hero content. Enforce industry eligibility on the server and database. Validate business rules, authorization, compatibility, image fallback, mobile/desktop layouts and existing scrolling.

## Implementation and files changed

- `modules/platform/public-page-style.ts`: industry/style mapping, safe Standard fallback, bounded appearance validation, image positioning and industry-appropriate copy.
- `modules/platform/public-page-theme.ts`, `app/globals.css`: independent Crimson palette; existing dashboard palettes unchanged.
- `components/public-page-style-form.tsx`: Standard/industry style selector, live hero preview, optional headline/introductory label/supporting text, image focus, cancel and pending save. Existing saved cover photo is reused.
- `app/dashboard/settings/public-page/page.tsx`, `actions.ts`: load and save the organization's style and hero fields. Theme and profile edits remain separate.
- `components/public-page-presentation.tsx`, `components/public-hero-media.tsx`, `app/public-page-styles.css`: four hero layouts, safe missing/failed image fallback, visit guide, closing action and branded footer. Styles are scoped to opted-in public homepages and previews.
- `app/shop/[slug]/page.tsx`: opt-in composition around existing catalog, branch, gallery and contact components. Standard retains its original hero/footer/content.
- `components/business-identity.tsx`, `components/public-shop-navigation.tsx`: optional wide logo presentation on larger screens; compact mobile identity remains readable. Existing default identity behavior is retained.
- `lib/public-booking.ts`: optional presentation fields for backward-compatible public payloads.
- Tests: `tests/public-page-style.test.ts`, `tests/public-page-theme.test.ts`, `e2e/public-page-styles.spec.ts`, its fixture, updated theme browser tests and the catalog scroll assertion, plus `supabase/tests/public_page_styles.sql`.

## Database, business rules and security

Append-only migration `0137_public_page_styles.sql` adds five organization fields: `public_page_style` (default Standard), nullable hero headline/label/description, and image position (default center). CHECK constraints enforce the industry/style pairing, text lengths and position allowlist. It extends the existing theme CHECK with Crimson and adds only `pageStyle` and `hero` to `get_public_shop`.

Existing organization RLS, owner/manager roles, active membership, public-page publication/status checks and tenant/branch catalog predicates are preserved. No grants on protected tables are added. Public RPC execution remains limited to its existing public projection. Server saves resolve industry and organization from authenticated membership, require `settings.manage`, validate all fields and sanitize errors. Browser-supplied organization/industry values cannot select the target or unlock another industry's style. Hero text renders as escaped React content; image sources are restricted to credential-free HTTP(S) URLs. No custom HTML/CSS is accepted.

Appearance remains free with no billing gate. Standard can always be restored without erasing custom hero text. Blank custom text uses industry defaults. Old/missing/invalid style payloads resolve to Standard. Styles do not change the chosen color palette. Concurrent appearance edits are last-write-wins; theme, cover and profile edits are not overwritten by an appearance save. Repeated saves are harmless. Any future industry conversion must reset the style to Standard or select the matching style in the same transaction.

Hospitality actions contact the property for availability; no online room reservation capability is introduced. Other industries keep existing booking routes and use contact actions when booking is unavailable. Private token pages and booking/basket workflows remain unchanged. Testimonials are intentionally absent.

## Validation performed

Node 24.20.0:

- `node --import tsx --test tests/*.test.ts tests/**/*.test.ts`: 595 passed. Explicit root and nested globs avoid the known existing npm-script glob omission in this environment.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, with the authorized build outside the sandbox for local compiler processes.
- `npx playwright test e2e/public-page-styles.spec.ts e2e/public-page-themes.spec.ts e2e/public-catalog-rows.spec.ts --project=desktop-chromium --workers=3`: 24 passed with installed Chrome and fixture-only `E2E_BASE_URL`. Tests cover all four styles at 1440/390/320px, independent horizontal catalog scrolling, booking/contact links, no testimonials, keyboard selection, preview editing, long headlines, cancel, pending save, refreshed preferences, return to Standard, seven color palettes and failed cover images.
- Browser fixtures simulate server action persistence and public payloads. These are component integration tests, not authenticated database end-to-end tests. Visual review used synthetic image fixtures; real business cover photos should be checked after rollout.
- `git diff --check`: passed.
- Compared the public RPC against migration 0136: only the two presentation fields changed; all existing catalog/publication/tenant/branch filters remain identical.

## Self-review and findings

Fixed narrow-screen logo crowding found in visual review by retaining compact mobile sizing while allowing wider desktop logos. Added failed-image fallback so hero copy/actions remain usable. Existing catalog browser assertion was corrected to allow Chrome's initial snap to the first card's padding offset; no catalog scrolling implementation changed. Reviewed state fallbacks, permission checks, constraints, safe links, escaping, CSS scope and duplicate-submission handling. No known BLOCKER or HIGH code findings remain.

## Remaining validation, risks and next step

The local Docker database daemon is unavailable. Migration execution and pgTAP assertions have not been run. The new rollback-only SQL suite covers free-plan access, defaults, valid/invalid industry mappings, bounded content, cross-tenant denial, viewer/inactive-member denial, anonymous write denial, publication/status gating and Standard restoration. Run it alongside existing branding/public-catalog/theme suites against a local/test database before release.

Apply migration 0137 after 0136 before deploying the application change; settings now query the new fields. No production data was changed and nothing was deployed. Use the normal reviewed release process, then verify a real authenticated save and anonymous public-page visit per industry. Real-device Safari validation and future paid-plan gating are deferred.
