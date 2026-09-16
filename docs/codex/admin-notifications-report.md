# Dialog locking and admin notification bell — Developer Report

## Changes

All open native dialogs now lock background document scrolling and the admin workspace/sidebar scroll containers. Dialog content keeps its own scroll area. The selector depends on any remaining open dialog, so closing one dialog cannot unlock the background while another remains open. Scroll positions are preserved naturally without setting the body to a fixed position or replaying old page offsets. Public documents reserve scrollbar space to limit layout movement.

Added an accessible header bell to the shared admin shell for Automotive, Salon and Pet Care. It shows outstanding message conversations, public booking requests, appointments awaiting confirmation, low/out-of-stock items, and overdue Automotive jobs, as permitted by the signed-in role. Alerts are restricted to the current branch. Appointment/job links open the next relevant record; message/booking/inventory alerts open the applicable working list. Opening the bell does not dismiss outstanding tasks. Counts drop when the original work is resolved.

The dialog includes counts, close/Escape/focus restoration, refresh, loading, empty, partial-source and request-failure states. Refresh runs every 30 seconds while visible, on navigation/window focus, and on open/manual refresh. Failed loads clear stale counts; scope changes remount the bell and abort old reads. It uses read-only queries and adds no schema or delivery infrastructure.

## Files

- `app/globals.css`: open-dialog background locks.
- `components/admin-notification-bell.tsx`, `components/app-shell.tsx`: shared bell, accessible responsive dialog and header placement.
- `modules/platform/admin-attention.ts`: permission/industry categories, branch-scoped count reads, links and partial failures.
- `app/api/dashboard/notifications/route.ts`: authenticated private/no-store read endpoint.
- `tests/admin-attention.test.ts`, `e2e/dialog-notifications.spec.ts`; extended existing customer-chat and website-map browser checks.
- Product/architecture docs, bounded plan and this report. Earlier chat work is retained.

## Security and behavior review

The API resolves organization, branch and role from the server session. It accepts no scope IDs from browser parameters. Every source explicitly filters organization and branch under the user's existing RLS, with server-side permission checks before queries. No service-role bypass, mutation, customer contact/body data, new table or RLS policy is introduced. Anonymous requests return 401; responses are private/no-store. Permission-restricted roles never query unauthorized categories. Failed categories do not make an incomplete result appear all clear. Private query diagnostics are not exposed in alerts.

Message notifications depend on the earlier chat migration 0080. If that table is unavailable, other categories continue working with a partial-update warning. This change requires no additional migration. No hosted data/schema changes or deployment were performed. External push, email, SMS, read receipts, and an archived notification history are outside this task.

## Validation

`npm test`: 371 passed, including four new notification tests covering query scope, role restrictions, industry routes, direct record links, failure isolation and empty counts. Lint, typecheck and production build passed with isolated local Supabase configuration. `git diff --check` passed.

The three customer-chat industry browser scenarios pass with notification API checks: anonymous denial, ignored forged scope parameters, private response headers, correct active organization/branch, message alert navigation and count decrement after staff reply. They also verify public document locking and preserved scroll position when chat closes.

The two notification browser scenarios verify workspace scroll locking, dialog-internal scrolling, Escape/focus restoration, scroll restoration, 320px/1440px overflow, and partial/empty/error states. Existing website-map scenarios verify the same lock through the shared admin FormDialog, plus its Cancel behavior. The first added admin-dialog assertion ran before its asynchronous route had opened the dialog; changed it to wait for the open-state style instead of sampling immediately. This was a test timing issue; notification and public-chat lock tests already passed.

No blocking self-review findings. Native browser dialog/focus behavior and current CSS :has support are used; Chromium desktop/mobile viewport emulation was exercised, not native Safari. No browser polyfill or dependency was added. See final run note below.

Final run: the focused notification and existing website suites passed all five scenarios after the final scrollbar/header alignment adjustments. Together with the three successful customer-chat industry scenarios, eight browser scenarios passed. `npm run check` passed after the final application edits (lint, typecheck, build). Inspected real loaded notification panels at 320px and 1440px. Reserved scrollbar space belongs to the admin's internal scrollers rather than the document, avoiding an extra workspace edge gap; long single-branch names truncate in the header. No remaining blocking findings. Recommended next step: use the bell in the current branch; if message updates show unavailable, install the previously prepared chat migration 0080. No new database migration or deployment was performed for this change.
