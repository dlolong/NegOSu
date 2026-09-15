# Pet Care implementation plan

Execution: single Developer Agent, as required by AGENTS.md. No independent agent review. Preserve the pre-existing staff, permissions, and billing work inspected before implementation (the temporary Git snapshot was lost when the environment restarted).

Runtime: `.nvmrc` selects Node 24; actual baseline Node v24.20.0, npm lockfile. No pricing/provider changes or hosted writes.

| Classification | Capability | Evidence / action |
| --- | --- | --- |
| REUSE EXISTING CORE | Customers, services, staff without login, resources, inventory, shared ledger | Existing tables and services; no duplicate Pet equivalents |
| CONFIGURE EXISTING CORE | Industry registry, navigation, onboarding, organization membership | Canonical `pet_care` key; existing public signup allowlist stays Automotive/Salon |
| CONFIGURE EXISTING CORE | Scheduling transaction adapter | `saveAppointmentWithPersistence` already supports atomic extension persistence |
| NEW PET CARE DOMAIN | Pets, owner relationship, appointment association, pickup/collection | Explicit relational data, snapshots, RLS and transactional RPCs |
| CONFIGURE EXISTING CORE | Appointment payments and customer links | Core TS exists; SQL still explicitly Salon-only. Narrow opt-in extraction implemented in 0071 |
| CONFIGURE EXISTING CORE | Resource capacity and parallel appointments | Core TS/SQL sums all overlapping rows; implement peak occupancy. Existing branch-wide conflict policy must remain default for existing verticals |
| CONFIGURE EXISTING CORE | Organization pilot access | No existing per-organization rollout flag found. Extend persisted industry configuration with a privileged pilot opt-in; do not introduce a general flag service |
| REUSE / CONFIGURE EXISTING CORE | Notifications | One outbox, token store, worker and provider adapters; Pet templates/eligibility only |
| DEFERRED | Vet/boarding/daycare/POS/retail consumption/multiple pets per appointment | Outside grooming MVP |

Sequence: baseline -> shared availability correction -> explicit Pet schema/RLS/atomic association -> grooming transitions/shared payments -> staff UI and owner links -> templates/eligibility -> non-production fixtures -> SQL/RLS/concurrency, browser, existing-vertical regressions, production build/health.

Acceptance: one pet per appointment, tenant/owner/branch integrity, same-pet concurrency protection, different pets may overlap with capacity, retained assignments and price snapshots, distinct completion/readiness/collection/payments, narrowly scoped private links, pilot enforced outside UI, no public signup. Report unsupported integration honestly; do not mark pilot ready with critical gaps.
