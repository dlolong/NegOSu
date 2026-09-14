# Reservation queue access — developer report

## Implementation

Removed customer queue links from the public storefront hero and location cards. Retired the slug-based queue page and API with 404 responses. Confirmed Salon reservations can open their branch queue from the private booking-status link on the appointment day, while the appointment is confirmed, checked in, or in service. Staff queue displays retain their authenticated access.

The reservation token determines the organization and branch in PostgreSQL. Callers cannot select another branch. Every poll rechecks eligibility, and denial clears displayed data. Changing credentials also clears the previous snapshot. Customer names remain abbreviated, business branding is retained, and private queue responses prohibit caching, indexing, and referrer disclosure.

## Files and database

- Storefront and retired routes: `app/shop/[slug]/page.tsx`, `app/shop/[slug]/queue/page.tsx`, `app/api/public/queue/[slug]/[branchId]/route.ts`; removed the obsolete public queue error boundary.
- Reservation entry and API: `app/booking/[token]/page.tsx`, `app/booking/[token]/queue/{page,error}.tsx`, `app/api/booking/[token]/queue/route.ts`, `lib/reservation-queue.ts`.
- Shared display/security: `components/customer-queue-display.tsx`, `components/open-queue-display.tsx`, `lib/private-route-security.ts`, `app/robots.ts`; removed the obsolete slug-based loader.
- Append-only migration `0069_reservation_queue_access.sql` revokes direct anonymous/authenticated execution of the old queue RPC and adds the token-authorized wrapper. No tables, historical migrations, or RLS policies change.
- Tests: new `tests/reservation-queue.test.ts` and `supabase/tests/reservation_queue.sql`; updated the restricted projection tests in `supabase/tests/public_salon_queue.sql`; replaced obsolete public-loader tests.
- Documentation: updated Salon, database, public data contract, testing, and UI conventions.

## Validation performed

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 284 passed. The sandbox blocked the runner's IPC socket; the authorized rerun outside the sandbox passed.
- `npm run build`: passed. Initial validation caught a missing client directive in the shared display; restored it and rebuilt successfully.
- `git diff --check`: passed.
- Applied migrations 0066–0069 to an isolated clone of the local database. Ran `psql -U supabase_admin -d negosu_reservation_check -X -v ON_ERROR_STOP=1` for `reservation_queue.sql` (24 assertions), `public_salon_queue.sql` (28), and `salon_public_booking.sql` (68): all 120 passed, with no failing TAP assertions.
- Chrome component integration checks: nine scenarios passed using the real display component, synthetic queue API responses, and a browser-image adapter. Covered 1440px, 390px, and 320px widths, horizontal overflow, reservation backlink, absence of branch switching, denial clearing data, changed credentials, and staff compatibility. Also checked the actual local retired API returns 404 with private headers.

## Self-review and limitations

Reviewed changed code, new migration, grants, tenant/branch joins, private data projection, failure states, credential changes, mobile layout, and obsolete entry points. Fixed contradictory documentation and the client directive found during validation. No unresolved blocking implementation findings. This read-only feature adds no submission, concurrency, or idempotency behavior.

The browser checks used synthetic data; a complete browser booking-to-confirmation flow against the hosted database was not run. Existing user changes and staging were preserved.

The hosted database was not modified and the app was not deployed. **Migration 0069 must be applied through the normal release workflow to revoke the old hosted RPC.** Until then, the app routes fail closed, but the database's existing public RPC privileges remain. Apply pending migrations in order, then deploy and smoke-test a private confirmed reservation and an anonymous storefront visit. Production rollout remains out of scope for this local implementation.
