# Customer queue display simplification

Updated the shared `components/customer-queue-display.tsx` used by reservation queues and authorized branch displays. The layout keeps business identity, branch, Now calling/In service, Waiting, useful customer instructions, and a compact Powered by footer. Removed the clock/date, healthy-connection status text, status dot, and automatic-rotation explanation. Pagination is a compact count only when needed.

Refresh and fullscreen are icon-only, with accessible names, tooltips, keyboard focus, 44px touch targets, disabled refresh feedback and fullscreen pressed state. Automatic polling, reservation navigation, stale-day protection, queue ordering and connection/fullscreen errors are preserved. No database, domain, RLS, route or access-control changes; previously retired unrestricted public queue URLs remain retired.

Added `e2e/customer-queue-display.spec.ts` with synthetic queue API responses for Automotive and Salon. Both browser scenarios pass: icon-only labels, refresh request, entering/exiting fullscreen, hidden nonessential text, connection failure/recovery, and 320px/1440px overflow checks. Inspected the 320px screenshot. Tests validate the shared renderer; they do not create reservations or modify customer data.

Validation: `npm test` (363 passed), `npm run lint`, `npm run typecheck`, local-config `npm run build`, focused Playwright suite (2 passed), `git diff --check`. Self-review found no blocking issues. No schema/deployment step is required. Native fullscreen support remains browser-dependent with the existing visible fallback; Safari was not tested. Earlier website and availability migration work is unchanged.
