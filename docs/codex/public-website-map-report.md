# Website administration and public location maps

## Bounded plan

Goal: provide editable branch map previews and clean mobile-friendly public websites for Automotive, Salon and Pet Care.

Reuse: existing `branches.map_url`, branch address/contact fields, public shop RPC, publication checks, booking flow, business branding and shared tabs/forms/cards. No schema migration or RLS changes.

Implementation: allow validated Google Maps embed links or copied embed HTML, storing only an allowlisted URL; preserve existing directions links. Provide a shared lazy-loaded location map with an accessible title and directions fallback. Organize website administration into profile, services, locations and gallery sections with clear save/cancel behavior. Improve public header, section navigation, service/location cards, contact actions and mobile booking access.

Security: never render pasted HTML, never embed arbitrary domains, retain server-side tenant/branch/role checks, do not geocode through the server or expose keys. Preserve private services and unpublished businesses.

Validation: map URL parsing/security tests, existing booking tests, authenticated local settings save/cancel and foreign-branch rejection, public/mobile browser checks across industries, booking regression, lint/typecheck/tests/build and visual review. No hosted data edits or deployment.

## Implementation summary

Website administration now has Website, Services, Locations and Gallery tabs. Location cards show address/map previews and open an editor for map and booking hours. Map input accepts a standard directions link or copied Google Maps Share embed code. Failed validation retains the complete draft. Cancel closes and discards location edits; profile/gallery Cancel returns to the relevant parent section. Saved actions return to their section. Branch address editing remains in the canonical branch editor.

Public websites retain the business's own branding and Powered by NegOSu footer. Added section navigation, accessible skip navigation, compact responsive hero/service/location sections, call/email links, per-location maps and directions, and a mobile booking/location action bar with safe-area spacing. Weekly hours follow weekday order and do not display undefined times. The booking page now exposes its summary and selected location map on mobile as well as desktop. Publication/private-service and public-queue restrictions remain unchanged.

## Files changed

- `app/dashboard/settings/public-page/page.tsx`, `actions.ts`: section navigation, location editing, validation/draft handling, branch-scoped persistence, section-specific redirects.
- `app/shop/[slug]/page.tsx`, `app/shop/[slug]/book/page.tsx`: public responsive layout, contact/navigation actions, shared location maps.
- New `components/location-map.tsx`, `components/location-map-field.tsx`: reusable map display, preview/editor and failed-save form wrapper.
- New `lib/location-map.ts`; updated `lib/public-booking.ts`: safe URL normalization, iframe allowlist, directions construction and form validation.
- New `tests/location-map.test.ts`, `e2e/public-website-map.spec.ts`; `docs/PRODUCT_ENTRY.md`; this report.

## Database, security, and backward compatibility

No schema migration, RLS policy change, dependency, API key, or geocoding service was added. Existing `branches.map_url`, address fields, public RPC and tenant authorization are reused. Existing normal HTTP(S) map links remain external directions links. Embedded maps only use HTTPS consumer Google Maps `/maps/embed` URLs on explicitly allowed Google hosts with a `pb` parameter. Other hosts, URL credentials, executable protocols and arbitrary HTML cannot become iframe sources. Pasted HTML is parsed for its URL and never rendered; attributes and unrelated URL parameters are discarded. Iframes have accessible titles, fixed responsive dimensions, lazy loading and an origin-limited referrer policy. Directions remain available if third-party maps are blocked.

The server retains the existing settings permission check, branch access RPC and organization-scoped update. Browser tests verify a tampered foreign branch ID cannot update another workspace. Map changes do not publish a disabled website or expose private services automatically. Only isolated local fixtures were written; their map/hour/publication/service visibility settings were restored. No hosted records or production deployment were changed.

## Validation results

- `npm test`: 363 passed, including four new map security/normalization/compatibility tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `e2e/public-website-map.spec.ts`: all three industry scenarios passed. Each verifies settings navigation, map preview, Cancel, validation draft retention, foreign-branch rejection, save/readback, public maps/directions, hidden public queues and booking navigation. Public layouts checked at 320, 390, 768 and 1440 pixels; administration at 320 and 1440 pixels.
- `e2e/pet-care-release.spec.ts`: both existing scenarios passed, including public booking through staffed grooming, internal notes, payment and collection, plus new-business onboarding.
- Provider responses are stubbed in deterministic browser regressions. A separate live Google Maps check retrieves Share → Embed a map HTML and verifies the normalized iframe independently; final result recorded below.
- Developer visually inspected public and admin screenshots. Mobile tests use Chromium viewport emulation; Safari was not exercised.

## Self-review and limitations

Reviewed changed and new files for iframe injection, unsafe links, tenant/branch boundaries, malformed hours, null map/address values, hidden public services, duplicate form submission controls, Cancel behavior, overflow, heading/action alignment and touch targets. No blocking implementation findings remain. Initial browser failures correctly reflected unpublished Automotive/Salon fixtures; the tests now explicitly publish local fixtures and restore their original states. Map tiles and third-party consent/network behavior remain controlled by Google, with directions links as a fallback. Existing unrelated hosted migration requirements are outside this website change.

Next step: for each real branch, use Website and booking → Locations → Map and hours, paste its Google Maps Share embed code, check the pin, and save. No business locations were guessed or populated automatically.

Provider references: [Google Maps Share/Embed instructions](https://support.google.com/maps/answer/11471036) and [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

Live provider result: passed. Retrieved Google's own Share embed code for Manila, normalized it through `normalizeMapInput`, and loaded the resulting iframe at 390px. Verified visible map controls/region, Google map attribution and an Open in Maps link retaining the Manila destination; visually inspected the rendered map. The first assertion looked for a visible place-name text label, which Google renders differently; it was corrected to verify the destination link and actual map controls.

## Contact and mobile navigation follow-up

Added `components/public-contact.tsx` and updated `app/shop/[slug]/page.tsx` to show business and published branch phone/email details, branch addresses, and configured website/social channels. Phone/email actions open the visitor's calling/email application; external contact channels are limited to safe HTTP(S) links. Missing contact information has a visible fallback. Existing public business data is reused; no schema, RLS, authorization or tenant/branch data-access changes were required.

On mobile, the business header stays at the top and section navigation moves into a fixed bottom menu. Services/Treatments, Locations and Contact remain available; Gallery and Book now appear when applicable. Desktop retains header navigation. Safe-area padding, touch targets, wrapping contact text, section scroll offsets and footer clearance support small screens. Self-review found the shared Button's inline-flex style overrode the initial mobile hiding class; a responsive wrapper fixes this and browser coverage now asserts the header booking action is hidden on mobile.

Updated `e2e/public-website-map.spec.ts` to verify business/branch contact hrefs, mobile section navigation, sticky header position, unobscured Contact heading and desktop navigation at 320, 390, 768 and 1440px across all three industries. Contact test values exist only in isolated local fixtures and are restored afterward. `docs/PRODUCT_ENTRY.md` documents contact maintenance and menu behavior.

Final follow-up validation: `npm test` (363 passed), `npm run lint`, `npm run typecheck`, local-environment `npm run build`, `git diff --check`, and the three-industry Playwright website suite (3 passed). Inspected the final 320px Contact screenshot: business identity stays visible, contact cards fit, and bottom menu labels/actions remain clear. Initial browser login failures resulted from building with the wrong environment; rebuilt against isolated local Supabase before the successful run. No deployment or production data updates. Safari/device-native calling and email handlers were not exercised; hrefs were verified. No known blocking findings. Next step: maintain actual branch contacts in Settings → Branches → Edit.
