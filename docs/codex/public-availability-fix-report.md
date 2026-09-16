# Public availability function resolution

## Finding and implementation

Anonymous, read-only queries against the configured database reproduced SQLSTATE `42725`: `public_booking_slot_is_available(uuid, uuid, timestamp with time zone, integer)` is not unique. Both published Automotive and Salon calendars returned the error. The repository's canonical helper has five arguments, with the grid-check argument defaulting to false; an obsolete four-argument overload remains in the configured database. The clean local migration history has only the canonical function.

Migration `0079_public_availability_function_resolution.sql` removes only the obsolete overload, checks that the canonical helper exists first, and preserves the default-argument path used by existing public daily/monthly RPCs and request review. It uses no CASCADE and touches no business rows. The canonical function continues to enforce hours, conflicts, tenant/branch scope and Pet Care staff/resource availability. Direct anonymous/staff execution of that private helper remains revoked. No RLS policies change.

The booking page now logs safe operation names and database error codes using the existing error reporter. Raw database messages, customer details, selection IDs and credentials are not logged or exposed to visitors. Existing availability fallback behavior is preserved.

## Files

- `supabase/migrations/0079_public_availability_function_resolution.sql`
- `supabase/tests/public_availability_function_resolution.sql`
- `app/shop/[slug]/book/page.tsx` (diagnostics only in this follow-up)
- `e2e/public-website-map.spec.ts` (assert booking has no availability error)
- This report. Earlier website/map/contact edits are preserved.

## Validation

Local SQL regression recreates the conflicting overload, verifies the exact reported failure, applies the migration, and checks compatible four/five-argument calls, denied direct helper access, all three industries' daily/monthly RPCs, actual Salon dates, cross-tenant rejection and migration retry. All 18 assertions pass. Existing Salon public booking (78), public-booking security (48), and Pet Care release (48) assertions pass: 192 database assertions total. Tests roll back their synthetic fixtures.

`npm test`: 363 passed. `npm run lint`, `npm run typecheck`, and a build using isolated local Supabase configuration passed. The migration was applied only to the local validation database. Review confirms the obsolete signature is absent from repository migrations, the canonical default supports existing callers, and no data or RLS changes are introduced.

## Deployment requirement / known risk

HIGH, unresolved on the configured database: availability remains broken until migration 0079 is applied there. This session has public API access for reproduction but no configured SQL connection or Supabase management credential/tool for applying hosted migrations. No hosted schema or customer data was changed. Apply this single reviewed migration through the project's normal migration tooling or Supabase SQL Editor, then reopen the public booking page. Do not use CASCADE if unexpected dependencies block the migration; inspect those dependencies first. This fix does not substitute for any other pending appointment migrations.

Final browser validation: all three industry website scenarios passed, including public booking with no availability error, mobile/desktop layouts, contact/navigation, and existing map/settings behavior. `git diff --check` passed. Chromium viewport emulation was used; no new Safari validation. Browser fixture changes were local and restored. Hosted verification after migration remains pending.
