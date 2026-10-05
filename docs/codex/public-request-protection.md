# Public request protection

Apply migration `0123_public_request_spam_protection.sql` after 0120–0122 before relying on the new database protection. No production changes were performed by the implementation.

Both public forms prevent immediate repeat submissions and disable inputs while pending. Existing hidden spam fields and product request-key idempotency remain active. Request-key retries return the same product receipt without using another allowance.

Database insert triggers cover product orders and all booking adapters, including promos and pet care. Shared limits allow five successful requests per normalized phone per business per fixed UTC hour, and 100 per business per fixed UTC hour, across both workflows and branches. Existing individual RPC rate limits also apply. Atomic counters and a per-contact transaction lock serialize concurrent inserts; failed requests roll back their counter changes.

Product orders reject another pending request for the same product and normalized phone within 15 minutes, even with a new request key or changed quantity. Booking requests reject the same branch/time/phone/subject while pending, regardless of changed email or service selection. Distinct pets preserve separate subject identities. Customers receive guidance to wait or contact the business to change a pending request.

Server IP fingerprints no longer include user-agent. Deployment proxies must overwrite forwarded IP headers. Contact and business limits are enforced independently in the database even if a caller supplies arbitrary RPC rate keys. Existing tenant/branch authorization and RLS remain unchanged. Guard functions are not executable by public roles; there are no new public data reads.

These controls reduce automated and accidental repeat requests; they do not verify phone ownership or eliminate distributed spam. Shared-phone users and busy businesses can reach the configured limits. There is no CAPTCHA or SMS provider dependency.

Validation: targeted tests, full unit suite, TypeScript checking, targeted ESLint, and both public form fixture compilations. SQL regression coverage added for duplicate detection, shared phone limits, business limits, phone normalization, tenant separation, and guard permissions. SQL execution was unavailable because the local Docker daemon was stopped. Browser runtime and concurrency tests were not executed.
