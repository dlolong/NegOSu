# Contact inquiries

## Implementation

The public `/contact` page accepts name, email, subject and message for the NegOSu platform team. Header and footer links expose it; it is included in the sitemap. `/admin/inquiries` is linked from platform administration and provides New/Closed views, 20-item pagination, expandable message text, contact email links and an idempotent Close action.

The form preserves entered values on error, disables submission while pending and reuses a random UUID for unchanged retries. Editing content creates a new request identity. Success replaces the form with confirmation. No automatic outbound email or customer communications are sent.

## Files

- `app/contact/{page,actions}.tsx/ts`, `components/marketing/contact-form.tsx`: public intake.
- `app/admin/inquiries/{page,actions}.tsx/ts`: protected inbox and close action.
- `modules/platform/inquiries.ts`: shared input schema.
- `components/marketing/{marketing-header,product-landing}.tsx`, `components/platform-admin.tsx`, `app/sitemap.ts`: discovery links.
- `supabase/migrations/0134_platform_inquiries.sql`: private storage and bounded intake RPC.
- `tests/inquiries.test.ts`, `supabase/tests/platform_inquiries.sql`, `e2e/contact-form.spec.ts`, `e2e/fixtures/contact-form.tsx`: regression coverage.
- `tests/launch-product-ux.test.ts`: follows the header extraction from the earlier task.

## Database and security

Migration 0134 is append-only and must be applied before use. No production schema or data was changed. The table has RLS enabled and no anonymous/authenticated grants or policies. Only the trusted server can execute intake or access inquiry data. Both admin page and close action independently call the existing deployment-controlled platform-admin guard before creating a privileged client. Tenant owner roles do not grant platform access.

Database constraints bound stored content. The intake RPC serializes requests using an advisory transaction lock, allows at most three new inquiries per normalized email per hour and 100 total per hour, and returns without reinserting exact retries. Reusing a UUID for changed content fails. Server validation adds email syntax checks and a honeypot field. Errors exposed to visitors are generic; inquiry contents are rendered as text.

The global limit bounds storage abuse but can temporarily deny legitimate submissions during a spam burst. Email limits and a honeypot are basic abuse controls, not bot-proof authentication. No new external anti-bot dependency was introduced.

## Self-review and validation

Reviewed server authorization, table grants/RLS, payload bounds, retries, concurrency, safe rendering, null/error/empty states, navigation IDs, pagination and mobile wrapping. No known blocking code defects. Existing customer/tenant inboxes are unchanged.

- `node --import tsx --test tests/*.test.ts`: 583 passed after correcting the existing test for the extracted header location.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings.
- Contact browser fixture compiled successfully; this does not validate browser interaction.
- `git diff --check`: passed.
- SQL suite not executed: local Docker daemon unavailable. Migration not applied.
- Browser suite added but not executed, respecting the earlier browser permission decline. Mobile/desktop layout received code review only.
- First webpack build failed when local disk space was exhausted. Removed generated Next.js caches and retried. `npm run build -- --webpack` passed, including TypeScript and page generation.

## Release follow-up

Apply migration 0134 to a disposable test database and run `supabase/tests/platform_inquiries.sql`. Exercise public submission, retries, admin/non-admin access, pagination and closure, plus `e2e/contact-form.spec.ts` at mobile and desktop sizes. Then apply the migration through the normal reviewed release process. Email replies remain a manual workflow; no deployment was performed.

## Close navigation and duplicate protection

The contact form now has an accessible top-right close link to `/`. Client submission retains pending protection and suppresses queued sends after success. Append-only migration `0135_platform_inquiry_duplicate_protection.sql` extends the serialized intake RPC: identical email/subject/message submissions within 24 hours return success without another row, even with a new request UUID; different messages from the same normalized email require a one-minute gap. Existing three-per-email/hour and 100-total/hour limits remain. RLS and service-role-only execution remain unchanged. Spam from changing email addresses is still bounded by the global limit, but this is not a guarantee against all bots.

Apply 0134 first if missing, then 0135. The SQL regression suite now covers new-ID duplicates and cooldowns alongside existing authorization, retry and hourly limits. Targeted lint, typecheck, both inquiry schema tests, and diff checks passed. SQL and browser checks remain unexecuted under the previously reported environment limitations. No production migration was applied.
