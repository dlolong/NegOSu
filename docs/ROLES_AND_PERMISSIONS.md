# Roles and Permissions

Salon job functions live in `organization_staff_profiles` and remain organization-specific operational metadata. Changing `Senior Stylist` to `Facialist` does not grant or revoke permission; only membership role and branch assignments do that.

Business Staff and authenticated membership are deliberately separate. A Staff profile may have no email, mobile number, or login. Its optional `membership_id` enables NegOSu system access; the membership owns the authorization role and access branches, while the Staff profile owns the person's business name, job function, operational branches, contacts, and active employment state. Changing a Staff contact email never changes the Supabase Auth login email.

The current authorization roles are `owner`, `manager`, `advisor`, `technician`, `cashier`, and `viewer`. They remain because KarKR workflows currently use them. `lib/rbac.ts` is the central application permission matrix; database policies remain authoritative.

| Role | Purpose |
| --- | --- |
| owner | Tenant control, staff, billing, and all operations |
| manager | Operational administration without ownership billing authority |
| advisor | Customer, vehicle, appointment, estimate, and job coordination |
| technician | Assigned work execution with limited customer/vehicle reads |
| cashier | Invoice and payment work |
| viewer | Read-only reporting/customer access |

Industry job titles are not automatically platform roles. Future labels such as detailer, stylist, or therapist should be staff profile specializations unless they need distinct authorization.

The Staff settings UI translates these stable authorization values for the active organization industry. Automotive displays `advisor` as **Service Advisor** and `technician` as **Technician**. Salon displays the same underlying permission groups as **Front Desk / Coordinator** and **Service Provider**. Salon titles such as Stylist, Facialist, or Therapist remain separate Job Function metadata. Invitations, staff records, edit forms, and permission matrices must use the same industry-aware presentation.

UI visibility is convenience only. Server actions validate inputs and check membership/permission; RLS enforces tenant, role, and branch scope. Owner-role assignment is restricted to controlled ownership workflows and cannot be requested through normal staff updates.

Apartelle & Inn reuses these authorization roles with Front Desk / Operations Staff display labels. Owners/managers configure room package and hourly extension rates. Cashiers, owners and managers receive payment and check in new arrivals; cashiers and Front Desk can check out, but stays with a held refundable deposit require a cashier/owner/manager to confirm its return. Cashiers/owners/managers can enter final discounted prices, card numbers and paper receipt numbers and record paid hourly extensions; Front Desk is read-only for these financial details. Guest identity is optional for new stays. Checkout sends rooms to Cleaning. Operations Staff (including Housekeepers), owners/managers, Front Desk and cashiers can mark a cleaned room ready; viewers cannot. Cleaning completion grants no finance or rate-editing permission. Operational viewers do not receive Hospitality financial data. Its trusted organization reporting policy also restricts financial aggregate RPCs while preserving other industries' existing report-viewer behavior. See [Hospitality permissions](HOSPITALITY.md#navigation-and-permissions).

Apartelle check-in/checkout staff selections are operational attribution from Core Staff profiles, independent of the signed-in user's access role. Both events retain selected cashier/housekeeper names plus the actual authenticated recorder; no selected identity grants financial access. Staff profile branch scope and active status are checked in SQL. Only owners see Apartelle's main-menu Billing & Plan link and Overview upgrade action; billing actions retain owner-only enforcement.
