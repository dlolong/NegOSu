# Cross vertical commerce implementation plan

Implement shared products, fixed-price promos, accepted purchases and attributable fulfillment without replacing existing financial or inventory ledgers. Execution is Developer-only under AGENTS.md. No previous Salon promo implementation was found in routes, modules, migrations or reports.

## Source of truth and reuse matrix

| Capability | Existing authority | Classification |
| --- | --- | --- |
| Product identity, unit, price | `inventory_items`, branch-specific SKU | EXISTS AND REUSABLE |
| Physical stock | Append-only `inventory_movements` | EXISTS AND REUSABLE |
| Allocated stock | `inventory_reservations` and operation keys | EXISTS AND REUSABLE |
| Services and booked duration | `services`, `appointment_services` snapshots | EXISTS AND REUSABLE |
| Appointment bill | `appointments.expected_total_centavos` from service snapshots | EXISTS AND REUSABLE |
| Job scope and bill | Approved estimates, job items, issued invoices | EXISTS BUT VERTICAL-COUPLED |
| Stay bill | `hospitality_stay_bills` links the existing manual invoice | EXISTS AND REUSABLE |
| Payments and reversals | `payments`, appointment/invoice collection RPCs | EXISTS AND REUSABLE |
| Physical job usage | `consume_job_part`, reservation operations and history | EXISTS BUT VERTICAL-COUPLED |
| Promo definitions and accepted snapshots | Absent | NEW SHARED CAPABILITY |
| Accepted product purchases and fulfillment | Absent outside automotive parts | NEW SHARED CAPABILITY |
| Products and Promos navigation | Inventory exists in all four verticals | CONFIGURATION REQUIRED |
| Promo context eligibility and approval | Existing scheduling, estimates and stay rules | NEW VERTICAL ADAPTER |
| Unit conversion and variants | No explicit safe conversion or variant model found | BLOCKED / DEFERRED; use native product units only |

## Bounded implementation sequence

1. Shared exact-quantity and promo contracts, branch/tenant validation and append-only catalog migrations.
2. Products and Promos management using existing dialogs, catalog identity and permission gates.
3. Immutable acceptance and fulfillment records linked to existing appointment/invoice/estimate contexts; atomic stock commitments through Core Inventory.
4. Vertical entry/detail adapters, payment/report integration, cancellation and physical returns.
5. Distinct review and regression pass: database non-privileged isolation tests, last-unit concurrency, four vertical workflows, browser mobile/desktop, lint/types/build.

## Rules and acceptance criteria

All prices are integer minor units; quantities use exact thousandths with no implicit conversions. Catalog edits never post stock. Accepted offers preserve component names, quantities, units and agreed price. Only confirmed use/handover creates stock events; payment and lifecycle labels do not. Automotive installed components remain under estimate approval and the existing parts workflow. Hospitality accommodation keeps its actual stay and invoice association. Existing posted history is never rewritten. Existing plan limits, tenant/branch scope, optional-contact Staff and route authorization remain authoritative.

Database migrations must be append-only and tested on disposable local data. No production migration, deployment, provider calls, real communications or customer charges are authorized. Local Colima was stopped at discovery; starting it for isolated validation was requested. Any unavailable test environment must be reported separately from implementation gaps.
