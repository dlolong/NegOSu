# Workspace list layout plan

Goal: extend the Payments navigation and table conventions to Inventory, Services/Treatments, Booking Requests, My Work, Staff and equivalent operational directories.

Reuse: shared Tabs, Table primitives, RecordRow/RecordLink, PageHeader, existing filters/pagination, dialogs and server actions. Add a small responsive record-table composition and URL-filter tab helper; keep business logic in existing Core/vertical services.

Affected modules: inventory workspace, service catalog, booking requests, staff directory/invitations, My Work, appointments, pets, jobs, customers, vehicles, scheduling resources and branch directory where the same card/list pattern appears. Purpose-built queue boards, dashboards, reports, public pages and detail/edit forms retain their workflows.

Database/security: no schema or RLS changes expected. Preserve authenticated reads, organization/branch scopes, role gating and authoritative mutation actions. Move booking review forms into the existing request dialog without changing confirmation rules or idempotency.

UI: meaningful route-based tabs; one responsive table per collection; primary record links and secondary actions on the right; compact metadata on phones; consistent headings, borders, filters and empty/error states. Keep semantic IDs where possible and update browser selectors where cards become rows.

Backward compatibility: existing route/query filters and edit/detail links continue to work. Closing a dialog returns to its list context where supported.

Validation/acceptance: all named directories use the shared list conventions; tab changes filter the intended records; rows open the correct record; edit/delete/review actions remain independent; no content overflow at phone/tablet/desktop widths. Add focused tab-URL tests and cross-industry browser checks, run relevant CRUD/booking regressions, unit tests, lint, typecheck, build and self-review.
