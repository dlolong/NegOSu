# Pet Care standard feature plan

Goal: make appointment-based Pet Care grooming a supported, self-service vertical. The user supersedes the earlier invitation-only scope. Veterinary medicine, boarding and daycare are separate products, not implied by grooming release.

Existing capabilities: Core customers, catalog, staff, resources, scheduling, payments, public storefront/request intake, subscriptions, branding, onboarding and notifications. Pet profiles, visit association, pickup and private links already work.

Implementation:
1. Register Pet Care in the canonical product/signup/onboarding/plan registry and remove public pilot messaging.
2. Append a migration enabling active Pet organizations without pilot opt-in; retain organization/branch/role checks, existing plan limits and compatibility for earlier records.
3. Extend Core public requests with Pet intake. Use server-resolved industry, existing rate limits and service validation. Staff confirmation links a verified pet/owner and assigns a groomer/resource through the Pet scheduling adapter, atomically.
4. Add appointment grooming notes with idempotent writes and branch isolation, visit history, searchable/date-filtered appointments, and shared payment visibility.
5. Update fixtures and tests; self-review diff, SQL/RLS, UI and errors. Run unit, SQL, concurrency, browser, lint, typecheck, build and health checks locally.

Security: no public pet directory or queue. Public intake cannot choose an internal pet/customer ID. Confirmation validates owner identity, tenant, branch, capacity and immutable snapshots. No pricing/entitlement bypass or production writes. New tables use RLS and restricted grants.

Acceptance: a user can choose Pet Care, create a business and branch, configure Core services/staff/resources, register pets, request/book/confirm grooming, maintain visit notes, record payments, mark pickup/collection, and use private links. Automotive and Salon regressions stay green. Public desktop/mobile flows accurately describe the supported feature.
