# Guided customer chat and staff inbox

Goal: reusable public chat for Automotive, Salon and Pet Care, using clickable service/location/hour answers, a limited custom conversation, staff replies, and the existing appointment request flow.

Existing capabilities: public business DTO, booking service/date selection, server-validated booking RPCs, branch-aware staff permissions, tabbed record tables, shared dialogs and branding. No chat/inbox currently exists.

Modules: Core chat contracts/validation; public widget and server actions; staff inbox and reply/close actions; booking handoff; platform navigation; append-only migration 0080; focused SQL, unit and browser tests.

Database/security: conversations and messages protected by RLS and branch/appointments.manage permission. Public access uses a random 256-bit conversation token stored hashed, mediated by server-only RPCs. No public table access. Staff author identity is resolved from auth.uid(). Customer messages max 300 characters and three per conversation, server-enforced under row locks. Creation limited by a server-derived visitor fingerprint; idempotent message IDs protect retries. Conversations expire after seven days. No notifications or external messaging provider.

UX: clear automated quick answers versus business replies; responsive dialog above the existing mobile menu; editable service/branch choice; one clear Book appointment action; 3-message counter; staff Needs reply/Open/Closed tabs, clickable rows, reply and close. Booking remains a request until confirmed. Missing service/branch, unavailable chat, expired/closed threads, pending, empty and error states are explicit.

Compatibility: existing booking paths and data continue working. Guided answers still work if chat persistence is unavailable. Existing customers without chat remain unaffected. No production migration/deployment is performed automatically.

Acceptance/validation: customer message reaches the correct branch inbox, staff reply returns to the same token, limits and retries work, foreign tenants/branches cannot read/reply, private services are absent, and booking preserves the selected public branch/service. Verify SQL RLS/limits/idempotency, unit validation, end-to-end local customer/staff flow, mobile/desktop, lint/typecheck/build, and self-review.
