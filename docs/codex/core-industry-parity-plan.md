# Core industry parity

Goal: repair Pet Care Payments and expose usable shared capabilities across the three supported industries (Automotive, Salon, Pet Care).

Evidence: configured database read-only probe returns PGRST202 for pet_care_financial_summary; ledger relation shape exists. Salon/Pet payments capability flags are false. Salon lacks payment navigation. Reports route/export are gated on Automotive Job Orders. Other shared customer, catalog, scheduling, staff, branch, resource, inventory, public booking, notification, and billing workflows already exist.

Implementation: compose one Core financial reader and payment workspace from existing records, with accurate full-result aggregation, paginated displayed records, controlled errors, and links to existing payment workflows. Preserve the old Pet URL as an alias. Enable Payments and Reports capabilities/navigation for supported industries. Add shared appointment reporting for Salon/Pet while retaining Automotive invoice reporting. Correct remaining shared terminology and audit entry points. Keep vehicle, Job Order, maintenance, and grooming rules in their verticals.

Database/security: Payments need no schema migration; remove dependency on missing Pet summary RPC. Add append-only migration 0075 for permission/entitlement-protected appointment reporting; preserve report-viewer access without weakening payment RLS. Authenticated reads remain RLS protected, server scoped to active organization and accessible branches. Keep payment mutation RPCs, permissions, idempotency and locking unchanged. No hosted mutation or deployment. Reserved Hospitality/Field Service remain unavailable.

Validation: finance aggregation/pagination/error tests; capability and navigation parity; authenticated pages/payment flow for all industries, including cashier/viewer, tenant/branch boundaries, empty/recorded payments, mobile/desktop; report/export consistency and entitlement checks; lint/typecheck/tests/build. Document capability audit and remaining deployment requirements from earlier phases.
