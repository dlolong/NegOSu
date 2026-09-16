# Dialog scroll locking and admin attention bell

Goal: lock background scrolling for every open native dialog; add a current-branch header bell with actionable work across supported industries.

Reuse: existing native dialogs, AppShell, authenticated dashboard context, appointments.manage/jobs.manage/inventory.manage permissions, RLS, chat needs_reply state, pending booking/appointment status, inventory low_stock and Automotive active-job statuses. No new notification ledger or delivery provider.

Implementation: global open-dialog scroll rules cover document and admin scroll containers without blocking dialog content. A protected, no-store read endpoint aggregates small count queries under the session's current organization/branch. A responsive header bell opens a dialog with counts, direct links, loading/empty/partial-error states and a refresh action. Refresh periodically and on navigation; scope changes clear old results. Badge represents outstanding work rather than read receipts.

Database/security: no new migration or mutation. Authorization is server-resolved and existing RLS remains authoritative. Unauthorized categories are not queried or returned. Source failures are isolated and reported as partial data, never falsely shown as all clear. Chat alerts depend on existing migration 0080.

Validation: unit tests for role/industry/category scope, partial failures and totals; browser tests for public and admin scroll locking, restoration/close, internal dialog scrolling, desktop/mobile bell and links, auth isolation and count updates. Run lint, typecheck, tests, build and self-review.
