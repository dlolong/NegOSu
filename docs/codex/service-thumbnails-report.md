# Public service thumbnails

Website settings → Services now includes a per-service thumbnail URL editor, live preview, clear action and pending submit state. It follows the existing website logo/cover/gallery URL workflow. Saving an empty URL removes the image. Direct file uploads are not part of this change.

Public service cards show consistently cropped 16:10 landscape thumbnails with lazy image loading and descriptive alt text. Missing or broken images use a neutral fallback while preserving card dimensions. Existing descriptions, prices, durations and booking links remain unchanged. The preview and public image component validate URLs and render external images directly, avoiding a server-side image fetch/proxy.

Files: `components/service-thumbnail.tsx`, `components/service-thumbnail-form.tsx`, website settings page/actions, public shop page, `lib/public-booking.ts`, migration `0100_public_service_thumbnails.sql`, unit/browser/SQL tests.

Apply migration 0100 before deploying this UI. It adds nullable `services.thumbnail_url` with an HTTP(S)/length/credential constraint and extends the existing `get_public_shop` service projection. Existing active/published business and public/active service filters, tenant category joins, function grants and RLS are retained. The save action authorizes website settings access, validates the UUID and image URL, scopes the update to the server-resolved organization and active service, and revalidates public/admin pages. Repeated saves set the same value; no new resource creation or billing mutation occurs. No production database changes were made.

Self-review covered cross-tenant IDs, unauthorized callers, URL validation, null images, failed loads, form nesting, duplicate submission controls, and stable DOM IDs. Pre-existing staff edits and the admin SQL test file were preserved.

Validation: 457 unit tests passed; lint and typecheck passed. Browser regression tests were added for previews, missing/broken images, clearing/submitting and horizontal overflow, but execution approval was declined. SQL tests were added for public projection, private/unpublished filtering, removal, unsafe URLs and anonymous write denial; they were not executed. Production build was blocked by sandbox worker-port permissions; escalation was declined, so no successful build is claimed.

Remaining verification: apply migration 0100 in a development database, run `supabase/tests/public_service_thumbnails.sql`, and execute `e2e/service-thumbnail.spec.ts` on desktop/mobile. Existing images require publicly reachable URLs; remote availability remains controlled by the image host.
