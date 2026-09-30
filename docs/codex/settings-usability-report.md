# Settings usability update

## Scope and implementation

Updated Profile & workspace, Branches, Staff, Resources / Service bays,
Website & booking (Business details, Services, Locations & hours, Gallery),
and Billing & plan. Related branch/resource editors and payment-history filters
use the same presentation conventions.

- Settings navigation uses responsive cards with short descriptions and the
  existing active-route logic. Subtabs wrap instead of requiring sideways scrolling.
- Profile includes account-specific explanations, a logo preview beside its form,
  and a compact two-column theme selector on phones.
- Branches and resources include counted status filters, actionable empty-state
  wording, and visible status badges. Resource capacity has a plain-language hint.
- Branch, staff, and website forms group related fields with accessible fieldsets.
  Staff instructions separate work assignments from login permissions.
- Website settings distinguish publishing, business details/images, and social
  links. Services explain visibility versus photo saving; gallery and opening-hours
  instructions explain the next action.
- Billing surfaces branch/staff limits before optional feature details, places
  payment history in the header, and uses an access-end label for prepaid/manual
  subscriptions.

Main files: settings route pages/layout, `settings-navigation.tsx`,
`settings-form-section.tsx`, shared Tabs/ListTabs, branding/theme forms,
BranchForm in `crm-forms.tsx`, `staff-management.tsx`, and `billing-overview.tsx`.

## Boundaries and self-review

No database migrations, business-rule changes, or RLS changes belong to this UI
update. Existing image-upload repair changes were already in the working tree
and remain separate. Server actions, form field names, tenant/branch predicates,
role checks, upload gates, and billing checkout conditions remain authoritative.
Default Tabs behavior remains available to other routes. Existing IDs are kept.

Self-review checked form boundaries, hidden inputs, labels, native validation,
reset/cancel behavior, read-only views, empty states, layout shrinkability, theme
tokens, and industry navigation. Fixed the previously blank branch status cell
for read-only viewers and consolidated duplicate resource empty states.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Node 24 `node --import tsx --test tests/*.test.ts`: 460 tests passed.
  Five initial failures referred to old text/component location; the expectations
  were updated for the new presentation while retaining their existing checks.
- Settings, Billing, and Staff browser fixtures compile with the real application
  CSS. New Settings browser tests cover navigation, nested active routes,
  hospitality section visibility, branch submission/required fields, logo reset,
  theme selection and mobile overflow.
- Browser execution: blocked during Chrome launch by the sandbox. Escalation was
  declined. Fixture compilation is not a browser test pass.
- Production build: blocked by Turbopack's local worker-port requirement.
  Escalation was declined; no build pass is claimed.
- `git diff --check`: passed.

## Remaining verification

Run `e2e/settings.spec.ts`, `e2e/billing.spec.ts`, and `e2e/staff-access.spec.ts`
on desktop and 320–430px phone viewports, then run the production build in an
environment that permits browser/worker processes. Review every Settings tab
with owner and manager accounts, plus read-only views and hospitality navigation.
Confirm logo/theme reset, each save/cancel flow, public-service visibility,
gallery uploads, location hours, and the billing history/checkout links using a
development database. No hosted data or real payments were modified for this task.
