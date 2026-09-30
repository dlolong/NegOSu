# Paid image upload configuration repair

The local app's configured hosted database was inspected read-only. Its paid plan
catalog lacked both `features.image_uploads` and `limits.storage_mb`, and Storage
reported that the `business-images` bucket did not exist. No customer records or
subscription state were read or modified. A paid subscription alone cannot enable
the missing database/storage setup.

The API now distinguishes effective Free-plan access from missing paid-plan
configuration. Free users retain the upgrade prompt; paid users see setup guidance
without being asked to purchase again. Both GET and POST fail closed. Existing
membership, role, same-origin, file validation, tenant RLS and quota checks remain.

Migration `0102_restore_image_storage_allowances.sql` restores missing/null storage
limits from the canonical 0028 catalog. It preserves explicit limits, including
zero, as well as pricing and subscription records. Migration 0101 must be applied
first to add feature flags, the bucket, RLS and the quota trigger. Do not replay
0028 wholesale to repair these missing defaults.

Hosted setup, pending operator execution:

1. Check applied migrations and prerequisites; apply 0100 if service-thumbnail
   support has not yet been installed.
2. Apply `0101_plan_image_uploads.sql` if not already applied.
3. Apply `0102_restore_image_storage_allowances.sql`.
4. In a development database, run `supabase/tests/plan_image_uploads.sql`.
5. Refresh the local app; verify a paid owner/manager can upload and save an image,
   Free users see the upgrade prompt, and staff/cross-tenant uploads are rejected.

No hosted migrations were applied. Database administration credentials/SQL tools
were not available in this session; the Supabase SQL Editor can execute the reviewed
migrations. Applying changes to a potentially production-backed project requires
explicit authorization under AGENTS.md.

Validation: three focused unit tests passed, covering paid configuration gaps,
Free access, valid/unlimited capacity and malformed capacity. Browser regression
coverage and a SQL prerequisite check were added; their execution remains pending.
