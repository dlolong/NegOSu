# Promo and service details with history

Promo desktop rows and mobile cards now open `/dashboard/promos/[promoId]`; separate Edit links retain the existing dialog flow. The new detail page shows the image, price, status, visibility, version, validity dates, description, and component names. Existing treatment/service rows already supported details and separate editing; their detail page now includes history.

Shared catalog history provides paginated appointment and purchase views with customer names, status, date/time in the active branch timezone, and links to source records. Appointment history includes scheduled, cancelled, and completed visits. Parent appointment/payment queries prevent multi-service promo duplication. Salon/pet purchase history uses recorded appointment payments (including refunds/voids), explicitly labeled as whole-visit amounts, not revenue allocated to a particular item. Automotive service purchases use billed invoice lines; automotive promo purchases show whole-job invoices containing the promo. Draft invoices and pending/failed payments are excluded.

Accommodation promo selections are not currently recorded by stays; the detail page explains why accommodation history is unavailable. This change does not introduce that workflow. Historical service lines without a service reference cannot be attributed and are not matched by mutable names.

Main files: `components/commerce-catalog-page.tsx`, `app/dashboard/promos/[promoId]/page.tsx`, `app/dashboard/services/[serviceId]/page.tsx`, `components/catalog-history.tsx`, `modules/core/commerce/catalog-history.ts`, and `components/service-thumbnail.tsx`. Tests: `tests/catalog-history.test.ts`.

Security/self-review: session Supabase client, existing RLS, explicit organization and active-branch restrictions, validated detail IDs, owner/manager gate matching the promo catalog, bounded pagination, batched component lookups, generic load errors, empty states, preserved edit destinations and semantic IDs. No migrations, privileged RPCs, writes, or business-rule changes.

Validation: 527 unit tests passed; lint and typecheck passed; production webpack build passed; git diff whitespace check passed. Database queries and browser layouts were not exercised against a running instance. Follow-up manual check: open a promo and treatment/service with appointment/payment records, switch history tabs/pages, verify active-branch filtering, then test Edit separately on desktop/mobile.
