# Plan-gated direct image uploads

## Implementation and plan rules

Business branding, website logo/cover, website gallery, and service thumbnails now accept direct JPG/PNG/WebP file selection in addition to existing image URLs. Uploads populate the existing URL field and preview; the user then saves the enclosing form. Upload progress prevents premature form submission, repeat selection is locked while uploading, and success/error states remain visible.

Migration `0101_plan_image_uploads.sql` adds the `image_uploads` entitlement: Free disabled; Starter, Business, Pro and Multi-Branch enabled. Existing plan names/prices are unchanged. Public plan highlights and authenticated feature lists advertise direct uploads. The effective plan controls access, including expiry/downgrade fallback. Previously published images and external URLs remain usable after downgrade.

The `business-images` public Storage bucket accepts only JPG/PNG/WebP up to 2 MiB each. Its tenant capacity uses existing `storage_mb` limits (Starter 1000, Business 5000, Pro 20000, Multi-Branch unlimited). This quota counts this new business-image bucket, not private job photos. Bucket keys are server-generated organization UUID / random UUID paths. Owners/managers may upload. Free users see an upgrade link; managers are directed to their owner. Failed entitlement reads fail closed.

## Files, security and database

New modules: `modules/platform/image-upload.ts`, `app/api/dashboard/images/route.ts`, `components/image-upload-field.tsx`. Integrated with business branding, website settings and service-thumbnail components. Updated feature keys, upgrade capability metadata, and plan presentation. Existing edits from previous staff/thumbnail work are preserved.

The POST route verifies same-origin requests, authenticated membership, settings role, live entitlements, bounded request body and file size, declared MIME type, and raster signature. No service-role credential is used. Signature checking is not a full image decode; a corrupt raster can be rejected by the browser and receives the existing fallback. SVG and non-image formats are rejected. Storage RLS enforces tenant path and plan access independently of UI controls. No authenticated overwrite policy is granted.

Storage performs preflight permission tests and finalizes uploads with privileged persistence, so quota enforcement uses a serialized trigger on `storage.objects` as well as RLS for access. The trigger rechecks effective entitlements and actual final metadata, covering expiry and concurrent upload races. Preflight without size requires up to 2 MiB remaining capacity. Implementation reviewed against [Supabase's uploader](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts).

Migration 0100 (service thumbnails) must precede 0101. No migration was applied to production. Existing tenant/branch policies are preserved. Images are intentionally public marketing assets; private inspection photos keep their existing workflow and bucket.

## Validation and limitations

459 unit tests passed via Node 24 `node --import tsx --test tests/*.test.ts`, including entitlement gating and file signature/size checks. Typecheck passed. Final lint result is included in the task response. Added browser fixtures for Free upgrade prompts and paid file selection, and transactional SQL tests for Free/paid/cross-tenant checks, final object size/quota rejection and downgrade preservation. Browser execution was declined. SQL tests and a live Storage upload were not executed. Production build failed because sandboxed Turbopack could not bind a worker port; escalation was declined. No build pass or live upload validation is claimed.

Uploaded files count toward quota even if the user abandons a form. Automatic garbage collection/media-library management is deferred; operators can remove unreferenced objects through Storage administration. Replacing an image does not automatically delete its previous object because other pages may reference it. Each upload gets a unique path; a network-ambiguous retry can create an additional object, which is quota-accounted. Saving the resulting image URL uses the existing idempotent field update.

Before release: apply migrations 0100/0101 in a development project, run `supabase/tests/plan_image_uploads.sql`, and verify the actual Storage integration with Free, paid owner/manager, unauthorized staff and cross-tenant accounts, including concurrent quota limits. Review Storage-trigger compatibility with the deployed Storage version. These integration checks remain a release prerequisite.
