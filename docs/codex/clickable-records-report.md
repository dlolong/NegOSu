# Clickable records — developer report

## Implementation summary and files

Added `components/record-item.tsx` with shared native-link navigation for table rows and cards. Record names remain actual Next links for keyboard navigation, context menus, and copying link addresses. Non-interactive row/card content follows that primary link. Modifier/middle clicks open a new tab. Nested links, buttons, forms, labels, inputs, selectors, and selected text do not trigger the row action.

Updated record lists in:

- Customers/Clients and Vehicles: entire record opens details; Edit stays at the right and is hidden for read-only roles.
- Services/Treatments: removed View buttons, linked names/rows/cards, and added trailing Edit for managers/owners. Categories open editing for managers or their filtered catalog for readers, retaining separate right-aligned Edit/Delete.
- Appointments, Job Orders, and technician work: removed redundant Open/View controls; clickable records retain independent work-session actions.
- Inventory and movement history: product rows/cards and linked movements open a read-only details dialog; Record movement remains an explicit trailing action. Details use the authenticated stock projection and preserve filters on Back/Close.
- Booking requests and Queue: clickable records open existing appointments/jobs or read-only previews; booking review and queue transition forms stay independent.
- Staff, staff schedule, Branches, and Resources: clickable settings records reuse permitted edit routes, with scoped read-only previews where applicable.
- Maintenance, vehicle service history, and Job Order parts: clickable record context and related appointment links replace redundant View controls.
- Command Center branch comparison: row/card navigation reuses the existing authorized branch-selection route with prefetch disabled.

Affected files are the corresponding `app/dashboard/**/page.tsx` files, `components/service-catalog.tsx`, `components/inventory-workspace.tsx`, `components/staff-management.tsx`, and `components/command-center/command-center.tsx`. Added optional inventory preview metadata to `lib/inventory-workspace.ts` and its existing server projection. Updated `components/management-ui.tsx` to wrap long dialog titles. Added the record-interaction browser fixture/spec, extended inventory tests, and updated removed View-button expectations in catalog and Salon tests. Updated UI/testing documentation.

## Database, business rules, and security

No migrations, RLS changes, or new mutation endpoints. New previews select only from existing authenticated organization/branch-scoped results. Read-only previews do not expose write actions. Existing server actions and database permissions remain authoritative. Branch comparison links use the existing branch-context validation and disable prefetch because that route sets the active branch cookie.

Opening, selecting, copying, editing, deleting, and running operational actions remain distinct interactions. Destructive actions are never invoked by clicking the containing row/card. Existing form submission and cancellation behavior is preserved.

## Validation

- `npm test`: **301 passed**.
- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:e2e -- e2e/record-items.spec.ts e2e/inventory.spec.ts e2e/service-catalog.spec.ts e2e/form-actions.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`: **141 passed**, using installed Chrome. This includes 21 shared row/card interaction checks, 39 inventory checks, 30 catalog/navigation checks, and 51 form regressions. Inventory checks also exercise tablet and constrained desktop content widths.
- Reviewed the rendered inventory screenshot for desktop layout, long linked names, borders, and trailing actions. Browser assertions covered mobile containment and long dialog titles.
- No database suite rerun was required: this change adds navigation/read-only projections and preserves all existing mutation/RLS boundaries.

## Self-review, limitations, and next step

Reviewed new wrappers and changed list markup for valid table/list structure, nested interactive controls, action alignment, role-gated editing, deterministic IDs, title overflow, safe preview selection, and database/tenant boundaries. Updated legacy assertions that required removed View controls. The new-tab test uses the platform-aware modifier to avoid macOS Control-click context menus. No unresolved blocking findings remain.

Informational totals, report aggregates, permission matrices, import previews, and static line-item summaries remain non-clickable because they have no individual record destination. Lists already implemented as complete record links remain so. No unrelated database behavior was changed.

Browser fixtures use actual shared/catalog/inventory components and CSS with synthetic navigation/action boundaries. They do not claim a hosted, logged-in browser-to-database run or native Safari coverage. Changes remain local and reviewable; no production deployment or hosted data mutation was performed. Recommended next step: review representative owner/manager and read-only lists in the local application, then use the normal release workflow.
