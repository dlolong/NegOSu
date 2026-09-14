# NegOSu UI Conventions

Public and shared customer-facing product chrome uses NegOSu. Automotive workspaces may present NegOSu Automotive and Salon workspaces NegOSu Salon & Beauty; KarKR and ServiceCore remain internal/legacy architecture terminology unless a compatibility surface explicitly requires them.

The master, Automotive, and Salon landing pages share small header, hero, feature, how-it-works, and footer primitives while supplying vertical-specific content. The first viewport keeps navigation, headline, calls to action, and a product visual visible at common desktop sizes. At 320–430 px, actions stack when necessary and the page retains one document scroll region.

Shared authentication uses `login-*`, `signup-*`, and password-recovery semantic IDs. Business selection cards use visible customer language, never internal keys. The multi-organization page uses `organization-selector` and stable `organization-option-<id>` forms; switching always posts to a server-authorized action. The compact setup checklist uses `onboarding-progress` and `onboarding-step-<key>` IDs and never traps the owner outside the application.

Salon Appointment detail prioritizes the one valid next lifecycle action, Customer self-service, and Payment balance. The public appointment page is mobile-first, outside the dashboard shell, `noindex`, and uses `public-salon-appointment-*` IDs. Staff rows keep authorization role visually separate from job function and show Today/Next schedule context loaded in batches.

These operational conventions are shared by KarKR and Salon. Industry configuration supplies terminology and capabilities; shared components must not hard-code Automotive labels when rendering a Salon organization. Salon uses `salon-*` semantic IDs on its page roots, primary actions, tables/cards, and appointment controls. Desktop record lists remain tables where practical and mobile layouts use compact cards.

## Navigation priority

Authenticated navigation uses one shallow, predictable taxonomy:

```text
Dashboard
Operations
Customers / Clients
Business
More
```

Dashboard remains a direct destination. The other groups have one collapsible level; the active group opens automatically. Common groups begin expanded, while secondary destinations stay behind More until selected. Compact 36-pixel desktop rows use regular or medium type, and the active item is identified by a quiet surface plus a small brand accent rather than a heavy fill or shadow.

Group headings and order communicate importance; navigation groups do not receive different decorative colors. Permission and industry filtering happen before grouping, empty groups are omitted, and Salon displays Clients rather than Automotive/customer terminology. Mobile bottom navigation is limited to Home, Bookings, Customers/Clients, and More. The More popup preserves the same grouped hierarchy and may scroll as a bounded navigation overlay when a short viewport requires it.

## Standard page anatomy

Operational pages use a compact header with title/context on the left and one primary action on the right. The main list or workflow begins after a single compact filter toolbar; avoid decorative hero spacing and repeated introductions.

Page, section, and dialog headers vertically center their action controls beside the complete heading block (title and supporting context). Action groups use centered items, remain right-aligned, and wrap below the heading when space is limited. Allow heading text to shrink and break long names; give it a reasonable flex basis on wider screens so buttons cannot squeeze it into a narrow column. Use the shared `PageHeader` and `SectionHeader` where practical. Labeled filter inputs and their submit buttons may retain bottom alignment so their input controls line up.

```text
Page title                         Primary action
Compact context
Search | common filters | more filters
Desktop table / mobile cards      Optional selected detail
```

`PageHeader`, `FilterBar`, `EmptyState`, and `StatusPill` in `components/page-patterns.tsx` are the focused shared primitives. They are intentionally compositional rather than a universal management-page abstraction.

## Admin color system

Authenticated workspaces use a restrained NegOSu admin palette: navy for structural chrome and primary text, blue for primary actions and interactive emphasis, soft slate for the page canvas and secondary surfaces, and white for working cards, tables, menus, and dialogs. Borders and shadows stay subtle so dense operational data remains the focus.

Semantic colors are reserved for meaning: emerald for success/available, amber for warning/busy/pending, red for danger/errors, and sky for uncommon informational feedback. Page eyebrows, links, selected plans, filters, and neutral information use the blue/navy/slate system. Navigation importance is expressed by grouping and order, never by rainbow color treatment.

The implementation contract is documented in `docs/DESIGN_SYSTEM.md`. Shared components keep backwards-compatible props while centralizing new visual behavior.

Users may choose one of the professional workspace palettes in Profile settings. Pages must continue consuming shared brand/admin tokens so the selection applies consistently; do not add theme-specific conditions to individual operational pages. Semantic status colors stay fixed, and public storefront branding is independent from the private workspace palette.

Public Page settings show publishing readiness, public services, booking locations, friendly day-by-day hours, and gallery content as distinct sections. Billing shows the current subscription before plan comparison and never offers a checkout interval that lacks a configured provider price.

Published storefronts use a compact business header, clear cover/identity area, service and location sections, responsive gallery, and persistent booking calls to action. The booking journey is date-first: visitors choose a location and one or more services (up to ten), then a month calendar shows only dates with enough continuous time for the combined duration, then time and customer details appear below. Unavailable dates are descriptive but non-interactive. Successful submission opens a private, responsive progress page with status text, schedule, services, and controlled automatic refresh. Public pages use one document scroll and retain the business's own logo and imagery independently from authenticated workspace themes.

## Lists, tables, and cards

- Use compact tables from the `md` breakpoint when records share comparable fields.
- Use cards below `md`; preserve the same identity, status, key operational context, and primary action.
- Keep rows approximately 40–56 pixels where content permits. Combine identity details such as vehicle/model and plate instead of creating secondary columns.
- Put long descriptions, notes, and history in detail views. Never hide critical status, money, or primary identity through truncation.
- Distinguish “no records” from “no filter results”; filtered empty states provide a Clear filters action.

## Create and edit flow

Services/Treatments use separate catalog and Categories views. Categories are a full-width list with Add category in the header and Edit/Delete controls on each row. Create/edit/delete use the shared dialog and action row; category editing retains drafts after server errors. Deleting a category requires confirmation and leaves its services under Uncategorized. Inactive categories remain visible for management and can be reactivated in Edit.

Nested dashboard pages use `DashboardBackLink` with explicit parent destinations from `lib/dashboard-back-navigation.ts`. Do not use browser-history Back for pages that can be opened directly. Existing context-aware Back controls remain in place for import, vehicle history, and job work pages. Dialog headers expose only Close, returning to their clean parent URL. Do not add a duplicate Back control when it has the same destination. Standalone pages retain their parent Back navigation. Dialog width variants use responsive maximum widths so the mobile full-screen default cannot override desktop sizing.

Simple create/edit actions open `FormDialog` from the list or current context. Existing form components and server actions remain authoritative and are reused inside dialogs. The dialog has a fixed header, one scrollable body, and reachable form actions. Successful list-launched mutations return to the list; legacy `/new` and `/edit` routes remain available for bookmarks and compatibility.

Use `FormActions` for editable forms. It spans all grid columns and aligns Cancel followed by the primary Save/Create action to the right at every width, wrapping when needed. Keep descriptive labels and decorative Lucide icons on action buttons; retain loading indicators while saving. Navigation buttons default to `type="button"`; only explicit submit controls submit a form.

Inside `FormDialog`, Cancel uses the dialog's clean `closeHref`, preserving list filters and removing the parameters that open the dialog. A mutation's `returnTo` may intentionally contain create/edit parameters for error recovery and must never be used as the Cancel destination. Standalone forms supply their list/detail `cancelHref`. Inline forms without a destination use native reset; controlled fields must restore their state through `onReset`. Inline quick-create sections provide an `onCancel` callback to restore the original selection without submitting the containing form. Cancel and Save are disabled while their form is submitting.

```text
List → Create dialog → Save → refreshed list
List/detail → Edit dialog → Save → current context
```

Large workflows—Job Orders, inspections, estimates, invoices, and multi-section operational details—remain dedicated pages.

Appointment and walk-in forms provide explicit Create and Cancel buttons for inline Customer/Client and Vehicle entry. Creating a record selects its saved ID without submitting the visit or clearing the appointment draft. Vehicles are limited to the selected customer; changing customers clears the previous vehicle selection. Salon forms provide Client creation and omit Vehicle controls. Creation errors stay beside the fields, and pending submissions disable their buttons.

## Filters and actions

Search is first and visible. Common status/branch controls follow it. Rare controls belong under a compact More filters disclosure when needed. Preserve search, status, branch, and page in links that launch dialogs. Use one visible primary row action; lower-frequency or consequential actions belong in a clearly labelled overflow or confirmation.

## Detail panels

A right-side detail panel is optional and only justified for frequent list/detail switching. It must not duplicate the page, must scroll only when taller than the viewport, and becomes a sheet or stacked summary on mobile.

## Scrolling and responsive behavior

The app shell owns one main content scroll region. The desktop navigation can scroll independently when taller than the viewport. Avoid nested vertical list/table scroll areas. Dialogs use `100dvh`, a single scrollable body, and actions within that body; mobile bottom padding keeps content clear of navigation. Horizontal table scrolling is a last resort—reduce columns or switch to cards first.

Review at 1366×768, 1440×900, and common mobile widths 320, 375, 390, and 430 pixels. Do not allow mobile page overflow, unreachable dialog actions, or bottom-navigation collisions.

The dashboard shell owns the primary vertical scroll region. `html`/`body` must not compete with its fixed viewport frame; the sidebar may scroll independently only when navigation exceeds the viewport. Dialog content is the only vertical scroll region inside a modal. Wide desktop tables may use their explicit horizontal frame as a fallback, but responsive routes should prefer purpose-built mobile cards.

## Shared interaction rules

- Primary, secondary, outline, ghost, danger/destructive, and icon buttons come from `components/ui/button.tsx`; meaningful controls provide at least a 44px touch target.
- Quiet action links remain visibly interactive through brand text, hover treatment, or their surrounding button/navigation surface.
- Tabs remain on one line and scroll horizontally on narrow viewports. The active item has a visible brand underline and `aria-current="page"`.
- Ordinary cards use the small elevation token. Medium elevation is reserved for deliberately raised panels and dialogs; large elevation is reserved for major overlays.
- Form feedback uses polite live status for success and assertive alerts for errors.
- Motion is brief and purposeful, and the global reduced-motion query removes animation and smooth scrolling when requested.

Complex Job Orders use compact top-level Overview and Work & approvals tabs plus contextual section links and a sticky desktop Service Advisor panel. On mobile the panel participates in the single page flow. Add/edit estimate lines, authorization, and payment are focused dialogs; never nest these dialogs. The first viewport should expose identity, status, estimate, authorization, parts, balance, blockers, and the recommended next action.

Reports keep the shared summary and filters visible, then use Overview, Revenue, Team, and conditional Branches tabs for secondary analysis. Billing keeps current access, price, and plan actions visible while placing detailed limits/features in native disclosure controls. Booking Requests keep decision actions directly reachable and stack them on narrow screens.

Public Plans use the same `modules/platform/plan-catalog.ts` presentation contract as authenticated Billing. The landing page provides an in-page comparison and links to `/plans`; public cards keep price, intended customer, important inclusions, and a clear signup or contact action visible without opening another control. Pricing copy must not imply that Automotive-only Job Order limits are Salon Appointment limits or promise vertical-specific capabilities to an industry where they are unavailable. Cross-industry cards use shared terminology such as Customers or Clients and Services or Treatments; additional capabilities are explicitly qualified by industry.

Onboarding shows one data-derived recommended next step at a time while retaining the complete checklist. Optional setup never traps the owner: **Skip for now and open dashboard** remains explicit. Empty operational lists explain why the area matters and, when the actor has permission, expose the next useful action directly.

Job Order Parts use a desktop table and mobile cards with Required, Reserved, Consumed, Available, Shortage, and Status values. Reserve, usage, and release are focused dialogs on the Job Order route. On hand is labeled as physical stock; released allocation must never be presented as a stock receipt.

Customer estimate review is a separate, mobile-first public page rather than a dashboard/portal shell. It shows business identity, basic vehicle context, itemized money, a prominent total, and explicit decision confirmation. It must never use wording that implies the link was sent when KarKR only generated/copied it. Invalid, expired, revoked, superseded, and already-decided states need calm, actionable copy without exposing internal identifiers.

## Spacing and typography

Page titles are compact (`text-2xl`, rising to `text-3xl` where appropriate). Prefer page gaps of 12–20 pixels and card padding of 12–20 pixels. Operational buttons use default or compact sizes rather than marketing-scale controls. Status color is consistent: neutral, success, warning, and danger.

## Accessibility and DOM IDs

Use native semantic elements and the existing accessible controls. Dialogs use the native modal API for focus trapping and Escape behavior, label their heading, and return navigation to a stable URL. Icon-only actions require an accessible label and title.

Use Server Components for initial protected data and Client Components only for browser interaction. Reuse `components/ui`, existing shells, form messages, submit buttons, cards, and badges before adding primitives.

Every meaningful rendered root, section, form, table, dialog, menu, control, and major action needs a deterministic semantic DOM `id`. Use kebab-case and include a stable record ID for repeated entities. React keys and DOM IDs are separate.

```tsx
<main id="customers-page">
<form id="customer-create-form">
<input id="customer-phone-input" />
<article id={`customer-card-${customer.id}`} />
```

Pages are mobile-first, avoid horizontal overflow, expose visible loading/empty/error states, preserve visible focus, use native semantic HTML, and keep touch targets practical. Dense tables may become cards on narrow screens. Reusable visual components should accept an `id` prop when practical and derive child IDs from it.

The current application predates the complete ID convention. Add IDs whenever a screen is materially changed; a dedicated screen-by-screen pass should use Playwright at 320, 375, 390, and 430 pixels rather than unsafe mechanical JSX rewrites.

Salon operational lists follow the same contract: Appointments, Clients, Treatments, Resources, and Staff render compact desktop tables and mobile cards with deterministic `salon-*` IDs. Create/edit appointment, treatment, and resource routes use `FormDialog`; the route remains bookmarkable while the form body owns the single dialog scroll region.

Maintenance uses a compact desktop table and mobile cards. Keep due-status counts and filters in the first viewport, preserve semantic `maintenance-*` IDs, and route rebooking through the existing appointment form instead of creating a parallel booking UI. Show the linked appointment and reminder state independently: “Appointment scheduled” suppresses reminders but does not imply completed maintenance. Use the standard dialog for an explicit snooze-until date and optional reason; keep Resume Reminders inline and retain the actual due date on screen.

## Owner Command Center

At 1366×768, keep business identity, operational date, branch selector, four to six compact metrics, Action Inbox preview, and the start of Today's Operations in the first viewport. On 320, 375, 390, and 430 pixel widths use two metric columns, then actions, then a vertical operations list. Do not introduce horizontal desktop tables or nested page scrolling on mobile.

Use the stable roots `negosu-command-center-page`, `negosu-command-center-header`, `negosu-command-center-branch-selector`, `negosu-command-center-metrics`, `negosu-action-inbox`, `negosu-today-operations`, `negosu-staff-snapshot`, `negosu-branch-performance`, and `negosu-command-center-quick-actions`. Repeated action IDs derive from the stable business/action identifier.

## Customer queue display

The Automotive Queue and Salon Appointments headers provide **Open queue display**. It opens `/display/queue/[branchId]` in a separate window with a Fullscreen control and no dashboard navigation. A signed-in staff session with branch access is required. The window remains pinned to its branch when the operator changes dashboard branches.

The display refreshes every 10 seconds and uses the branch's local day. Automotive shows waiting ticket numbers and called/ready tickets. Salon shows checked-in clients waiting and clients in service, using first names plus last initials and appointment times. Scheduled and finished appointments are excluded. Large queues rotate through pages automatically; short windows scroll vertically.

The server checks access on every refresh and returns only display fields. Customer contact details, plates, prices, and notes are excluded. Responses are private, uncached, and excluded from indexing. Access loss clears the queue; temporary connection failures retain today's snapshot with its last update time. Rows from the previous local day are cleared even when disconnected. This feature requires no database migration or anonymous public access policy.

Salon storefronts do not expose customer queues. A confirmed reservation's private booking-status page provides **View your branch’s queue** on the appointment day while the appointment is confirmed, checked in, or in service. This opens `/booking/[token]/queue`, reusing the fullscreen display, refresh interval, and paging. The token fixes the branch; customers cannot switch branches. **Your reservation** returns to the booking details. Only today's checked-in and in-service clients appear, with first names plus last initials and appointment times.

Migration `0069_reservation_queue_access.sql` restricts the projection introduced in `0065` to verified reservations. The old storefront queue page and slug/branch API return 404, and direct anonymous/authenticated execution of the old RPC is revoked. Reservation eligibility, publication, active organization, Salon industry, and branch ownership are checked on every read. Access loss clears displayed rows. The staff-operated display remains available to authorized staff independently of public-page publication.

## Inventory workspace

Inventory gives the active branch's stock the full content width. Separate Stock and Movement history views; history shows the latest 30 branch movements with timestamps in the organization's timezone. Summary links filter products by healthy, low, or out-of-stock status. Stock at zero is Out of stock; positive stock at or below its reorder level is Low stock. On hand describes physical balance, not unreserved availability.

Use search, category/status filters, twenty-product pages, desktop tables, and responsive cards. Product/movement/transfer/recipe forms open in the shared route-addressable dialog, with Close and right-aligned Cancel/Save. Keep filters when closing or saving; return validation errors in place and preserve drafts. New products start at zero; opening stock is an explicit movement. Optional product metadata can be collapsed, and existing categories are offered as suggestions.

Transfers show matching SKUs in a different accessible branch and clear the destination if the source changes. The database still checks permissions, reservations, stock availability, and transfer integrity. Automotive recipes stay hidden from Salon. Stock query failures must show an error instead of misleading zero-value metrics.

## Opening records from lists

Use `RecordRow` for table records, `RecordCard` for styled cards, and `RecordItem` for article/list-item containers. Place one `RecordLink` on the record's name or primary identifier. Clicking non-interactive row/card content follows that link; keyboard users Tab to the native link and press Enter. Keep native table/list semantics. Modifier/middle clicks open a separate tab, and selecting text must not navigate.

Keep Edit/Delete and other explicit actions in the trailing table cell or right-aligned wrapping card action group. Do not add a separate Open/View button for the same destination. Related-record links, buttons, forms, labels, selection controls, and text fields operate independently of the containing record. Use `data-record-ignore` for any other interactive area that must not trigger navigation. Never wrap an entire interactive card in an anchor containing other links or buttons.

Use the existing detail page when available, or the existing edit form for an editable settings record. Read-only previews are available for inventory products, booking requests, standalone queue entries, branches/resources, and staff context. Preview records are resolved from the same server-scoped data used for the list; opening a record does not grant write access. Read-only roles must not see Edit/Delete controls. Financial aggregates, permission matrices, import previews, and static line-item summaries do not have record destinations and remain informational.
