# Guided customer chat and staff inbox — Developer Report

## Implementation

Added shared customer chat for Automotive, Salon and Pet Care. Clickable guidance reads the existing public service catalog, starting prices, duration, location and posted hours. Customers can use booking/service question suggestions or write a short custom message. Messages reach the selected branch's Customer Inbox; staff replies return to the original browser chat. The booking action carries the public branch/service selection and prefills customer name and editable customer-message notes in the existing booking form. No staff replies are copied into booking notes, and final availability/price/booking confirmation remain authoritative in the existing flow.

The public panel has a persistent booking action, keyboard close/focus restoration, one scrollable conversation area, mobile menu clearance, semantic IDs and empty/error/closed/limit states. The inbox uses Needs reply/Open/Closed tabs, clickable table rows, pagination, branch scope, automatic refresh, replies, and close/reopen controls. No external email or SMS is sent.

## Files

- `modules/core/chat/contracts.ts`: bounded public/staff schemas, shared snapshot contract, storage namespace and booking-note projection.
- `supabase/migrations/0080_customer_chat.sql`: conversation/message tables, indexes, constraints, scope trigger, RLS/column grants, service-only public RPCs, authenticated staff RPC.
- `app/shop/[slug]/chat-actions.ts`, `components/public-chat.tsx`, public storefront integration and booking form handoff.
- `app/dashboard/inbox/{page.tsx,actions.ts,conversation.tsx}`; platform navigation and shell icon.
- `tests/customer-chat.test.ts`, `supabase/tests/customer_chat.sql`, `e2e/customer-chat.spec.ts`.
- `docs/PRODUCT_ENTRY.md`, `docs/ARCHITECTURE.md`, bounded plan and this report.

## Rules and security

Customer messages: three per conversation, 300 characters each. New conversations: five per business/visitor fingerprint in a rolling 24 hours. Staff: 1,000 characters per reply, up to 50 replies per conversation. Customer access expires after seven days; staff retains history. Customer tokens are random 256-bit values, stored hashed in the database and held in session storage by the browser; tokens do not appear in URLs. Closing the browser tab/clearing session storage may lose reply access. Storage failure leaves the current open chat usable but cannot restore it after navigation.

Public reads/writes are server-action mediated, validated, and restricted to published active businesses and active branches. Public-facing RPC execution is granted only to service_role, preventing clients from forging the visitor rate key. Staff reads require appointments.manage plus branch access via RLS; mutations recheck those permissions and derive author identity from auth.uid(). Staff cannot select token/visitor hashes or directly insert/update messages. Conversation scope is immutable and validated against branch ownership. No existing RLS was weakened.

Token/visitor advisory locks serialize first-message creation and creation quotas. Conversation row locks serialize message counts, closure and staff replies. Stable request IDs make retried sends idempotent; changed content under a reused ID is rejected. Messages are timestamped with clock_timestamp() at insertion so a waiting transaction's earlier start time does not reorder the conversation. Read/send response sequencing prevents an older poll overwriting a newer reply. No private service data is queried for guidance; existing public DTO fields are reused.

## Self-review

Reviewed permission enforcement, tenant/branch scope, private token handling, raw error logging, untrusted IDs, retry/concurrent-send behavior, history limits, stale responses, component identity across business/conversation changes, booking draft preservation, dialog focus, mobile overflow, unavailable persistence and empty published data. Fixed message timestamp ordering discovered by rollback tests, preserved per-business/per-conversation component state boundaries with React keys, kept booking visible on narrow screens, and corrected the no-location message state. No known blocking implementation findings remain.

## Deployment and practical limits

Migration 0080 was applied only to isolated local Supabase. The hosted environment still requires the reviewed migration through its normal SQL/migration tooling, plus the existing server-only SUPABASE_SERVICE_ROLE_KEY. No hosted schema/data changes or deployment were performed. This session has no hosted SQL/management connection. Until the migration is installed, quick guidance and booking links work, but persisted messaging/inbox cannot work there.

Staff replies are polled while the chat is open; this is not an online-presence guarantee. Customer and staff polling intervals are 10 and 15 seconds respectively. No outbound notifications, attachments, AI-generated answers or cross-device conversation recovery are included. Visitor creation throttling reuses the application's trusted-proxy IP/user-agent fingerprint convention; it is not a CAPTCHA. No new infrastructure or package dependency was introduced. Safari/native mobile keyboards were not separately tested.

## Validation performed

- `npm test`: 367 passed, including four new chat contract/booking-note/navigation tests.
- `supabase/tests/customer_chat.sql` via local PostgreSQL/pgTAP: all 45 assertions passed, including all industries, customer/staff idempotency, length/quantity limits, foreign tenant and restricted-branch access, denied viewer/public access, no direct writes/token-hash reads, close/reopen, visitor quotas, publication and expiry. Synthetic fixtures roll back.
- `e2e/customer-chat.spec.ts`: all three industry scenarios passed. Real local customer → branch inbox → staff reply → customer receipt → booking handoff, plus five concurrent sends with only the remaining two accepted; customer UI then disables additional messages. Tests cover message suggestions, mobile/desktop layouts, a visible booking action, staff mobile dialog, closing/restoring a conversation, close-button focus and preserved customer booking notes.
- `e2e/public-website-map.spec.ts`: all three existing industry website scenarios passed with the chat installed, including contact/navigation, public booking, map/settings validation and foreign-branch rejection.
- Lint, typecheck and production build passed using local Supabase configuration. Final `npm run check` repeats these after the last empty-state wording fix.
- `git diff --check` passed. Inspected customer/staff 320px screenshots; layout checks also cover desktop. Browser coverage uses Chromium viewport emulation. All browser fixture changes were local and restored, and test conversations were deleted afterward.

Recommended next step: apply migration 0080 in the target Supabase project, deploy the reviewed application changes through the normal process, and check one public message/reply using a test business before opening it to customers. Existing booking confirmation and staff permissions do not change.

Final verification: `npm run check` completed successfully after the final empty-state copy change (lint, typecheck, build); `git diff --check` also passed. Implementation and local verification are complete. Hosted activation remains the explicit deployment requirement above.
