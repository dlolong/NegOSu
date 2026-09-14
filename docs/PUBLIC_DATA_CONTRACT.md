# ServiceCore public data contract

Anonymous callers receive data only through Phase 10 RPCs. They have no direct access to organizations, branches, services, customers, vehicles, appointments, jobs, invoices, payments, staff, internal inspections, private job photos, booking-request rows, or rate-limit rows.

`get_public_shop` exposes only a published shop's name, slug, public description and images, public contact/social links, active branch address/contact/hours/map fields, explicitly public services, and active gallery images.

`get_public_availability` exposes timestamps for one service; `get_public_availability_for_services` exposes timestamps that can fit the combined duration of one to ten unique selected services. Their bounded date projections expose only dates and slot counts. They never return appointment records, customer names, staff identities, schedule contents, or capacity details.

`submit_public_booking` accepts validated contact and vehicle information into the isolated booking-request tables. Its response contains only a random confirmation token and public reference. Existing-customer matching happens only during an authorized internal confirmation and is never disclosed publicly.

`get_public_booking_status` requires the random confirmation token and returns only reference, request/appointment status, shop/branch names, public shop slug, preferred or confirmed schedule, service snapshots, last status timestamp, and an optional decline reason. This powers the private customer progress page and does not return contact information, vehicle identifiers, internal notes, customer IDs, appointment IDs, or staff data.

## Business branding

The published shop already includes `logoUrl`. Migration `0068_business_branding.sql` also exposes `logoUrl` in the existing booking status, Salon appointment self-service, and public Salon queue responses, and within `business` for estimate approval. These fields come from the organization already resolved by the published slug/branch or valid private token. No new public table access or arbitrary organization-ID lookup is introduced. Inactive/invalid/expired/revoked private responses retain their existing restricted shape.

Logo fields are optional during rollout; missing values render business initials. UI validation and rendering permit only HTTP/HTTPS sources without URL credentials. Remote images use browser requests with `no-referrer` rather than server image proxying.

## Reservation-only customer queues

Migration `0069_reservation_queue_access.sql` removes direct anonymous/authenticated access to `get_public_salon_queue(slug, branch_id)`. Public slugs and branch IDs cannot grant queue access. The storefront has no queue links; `/shop/[slug]/queue` and `/api/public/queue/[slug]/[branchId]` return 404.

`get_reservation_queue(booking_token)` accepts only the existing private 64-character booking token. It verifies a confirmed booking and its same-organization, same-branch appointment, checks confirmed/checked-in/in-service status and the current branch-local date, and retains the active/published Salon and active-branch checks. It resolves scope from the token, never caller-supplied business/branch IDs. Unknown, pending, cancelled, completed, past/future, or mismatched reservations return no data.

Eligible customers open `/booking/[token]/queue` from their booking-status page. Every poll to `/api/booking/[token]/queue` repeats authorization; a denied response clears the display. Queue HTML/API are no-store, noindex, and no-referrer. Staff queue access continues through authenticated branch authorization.
