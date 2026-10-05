# Staff history and public website follow-up

## Delivered changes

- Staff directory names open `/dashboard/settings/staff/[staffId]`, using the product-detail pattern: profile summary, separate edit action, completed-work table, search/date filters and pagination. Staff management remains owner-only.
- Service/promo histories list multiple recorded employees, deduplicate repeated sessions, filter service-specific assignments to the selected item and distinguish whole-visit/job participation from exact service assignment. Automotive completion snapshots are preferred when available. Existing missing attribution is never manufactured.
- Public website desktop header stays pinned with a subtle scroll shadow. Menu order is Services/Treatments, Products, Promos, Locations, Contact, Gallery. Tablets use a separate menu row; anchors clear the actual header height. Progressive section reveals respect reduced-motion settings.
- Public chat separates quick answers and team messages. New conversations collect name plus mobile/email before the composer, retain drafts and retry identity on failure, and expose contact information in the authorized inbox. Existing conversations remain usable.

## Main files

Staff: `app/dashboard/settings/staff/[staffId]/page.tsx`, `components/staff-management.tsx`, `components/staff-work-history.tsx`, `components/work-contributors.tsx`, `modules/core/staff/work-history.ts`, `components/catalog-history.tsx`, `modules/core/commerce/catalog-history.ts`. Fixed the settings → staff link to use Next Link after the new route exposed an existing lint error.

Website: `app/shop/[slug]/page.tsx`, `components/public-shop-navigation.tsx`, `components/public-website-effects.tsx`.

Chat: `components/public-chat.tsx`, `modules/core/chat/contracts.ts`, `app/shop/[slug]/chat-actions.ts`, `app/dashboard/inbox/page.tsx`.

Append-only migrations: `0124_customer_chat_contact.sql` and `0125_staff_work_history.sql`. No migrations or production changes were applied by this session. The saved 0125 includes the customer join omitted from its initial work-session SELECT; re-copy the current file if an earlier selection produced SQL error 42P01.

## Security and business rules

New history views use security_invoker and preserve source RLS, explicit tenant joins and branch predicates. No anonymous view grants or new mutation privileges. Profile contacts remain owner-only. Staff histories exclude unfinished/cancelled work, preserve inactive/no-login staff, and count a person once per parent work record. Appointment dates are labeled appointment times rather than invented completion timestamps. Hospitality records represent recorded check-in/check-out duties, not a separate task system.

Chat contact fields remain inside existing staff inbox RLS and are not included in public snapshots. New contacts are enforced in client guidance, server validation and database constraints/trigger/RPC; old conversations with null contacts can still receive replies. Existing locking, message quotas and idempotency are retained.

## Validation actually performed

Using Node 24.20.0:

- `node --import tsx --test tests/**/*.test.ts`: 552 passed.
- `npm run lint`: passed after correcting the settings staff link.
- `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed, including the new staff detail route.
- Browser fixtures for staff history, public chat and public navigation bundled successfully through the repository's existing fixture renderer.
- `git diff --check`: passed.

Added/updated unit coverage for contact validation, legacy chat contracts, scoped staff queries, contributor deduplication, multiple employees, service filtering, snapshot names, source links and complete child pagination. Added browser regressions for contact-first messaging, retries, restored conversations, short mobile layouts, menu ordering, pinned header/shadow, anchor clearance, reduced motion, staff history and multiple contributors. Updated the existing integrated chat and website tests. SQL regressions cover contact requirements and staff-history tenant/branch isolation, completed-only records and no-login/inactive staff.

Browser tests did not execute successfully: bundled Chromium was absent, sandboxed Chrome could not launch, and the outside-sandbox execution request was declined. Database tests were not executed; local Docker was initially unavailable, its VM startup succeeded, but the subsequent inspection request was declined. Consequently, SQL migrations/RLS behavior and actual desktop/mobile browser layout remain unverified. No runtime/database pass is claimed.

## Review findings and remaining work

Fixed the initial missing customer join in migration 0125, source attribution after automotive assignment changes, failed-first-send polling, the hidden-menu test locator, and the staff navigation lint failure. Existing unrelated workspace edits were preserved.

Before release, validate migrations 0124/0125 and their SQL tests in a disposable database, then run the authored browser/integration suites. Apply reviewed migrations through the normal deployment workflow before deploying code that reads their columns/views. Do not infer historical per-service completion when only visit/job assignments were recorded; a new per-service completion capture workflow is outside this read-only history change. No deployment, customer communications, payroll, or financial-rule changes were performed.
