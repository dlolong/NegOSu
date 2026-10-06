# Dashboard and settings layout refinement

## Follow-up: independently scrolling right column

The user subsequently requested a right-side panel with its own scroll. This supersedes the dashboard's left-column layout described below; settings navigation remains on the left.

- `WorkspaceColumns` now uses an 18rem right column at xl. It is sticky, viewport-height constrained, keyboard-focusable, and vertically scrollable with contained scroll chaining and stable scrollbar space.
- Website details, feature previews, quick actions, and the staff snapshot are grouped in that panel. Metrics now start the primary column alongside it.
- Mobile/tablet retain ordinary page scrolling without a height limit on the supporting cards.
- Updated browser assertions cover right-side placement, independent keyboard scrolling, unchanged primary-content position, mobile overflow behavior, and the staff card's placement. Fixture compilation passed; browser execution remains unrun following the earlier declined permission.
- Follow-up lint, typecheck, all 464 unit tests, `npm run build -- --webpack`, and diff whitespace validation passed. No data, authorization, or RLS changes.

## Implementation and files

- Added `components/workspace-columns.tsx` for a 16rem supporting left column at viewport widths of 1280px and above. Primary work comes first on smaller screens and in DOM reading order. No new scrolling containers.
- Updated the command center to place website details, feature previews, and compact quick-action rows in the left column. Metrics remain above the columns, while the action inbox and today's operations precede charts.
- Applied the shared layout to staff and pet-care dashboards. Hospitality inherits it through the command center. Existing technician and hospitality staff redirects remain unchanged.
- Updated `app/dashboard/settings/layout.tsx`, `components/settings-navigation.tsx`, and `components/ui/tabs.tsx` so settings navigation occupies a 14rem left column on wide screens and retains its responsive card grid on smaller screens.
- Updated `components/dashboard-discovery-content.tsx` for the narrow information column and documented the convention in `docs/UI_CONVENTIONS.md`.

## Data, security, and compatibility

Presentation-only changes. No database, migrations, authorization, RLS, tenant/branch scoping, or business-rule changes. Existing route targets, data loading, status/error/empty states, and interactive IDs remain intact. No deployments or production mutations.

## Tests and self-review

- Added `e2e/workspace-columns.spec.ts` and its fixture to check desktop column positions, mobile content order, settings active navigation, single quick-action rendering, and overflow.
- Fixture JavaScript and Tailwind CSS compilation passed. Browser assertions remain unrun because browser execution was previously declined in this session; compilation does not establish visual correctness.
- `node --import tsx --test tests/*.test.ts`: 464 passed.
- After compacting quick actions, `node --import tsx --test tests/currency-presentation.test.ts`: passed.
- `npm run lint`: passed.
- `npm run build -- --webpack`: passed.
- `npm run typecheck`: passed after the build. An overlapping run initially encountered generated `.next/types` files being replaced by the build; rerunning sequentially resolved it.
- `git diff --check`: passed.

Self-review checked narrow column widths, long website addresses, branch-performance cards at laptop widths, preserved navigation/permission behavior, content order, and unchanged error states. Quick-action descriptions remain available to screen readers while visible labels and arrows use compact rows. No blocking findings identified.

## Remaining validation

Run `npm run test:e2e -- e2e/workspace-columns.spec.ts e2e/dashboard-discovery.spec.ts` with browser execution enabled, and review populated dashboards/settings on desktop and phone. Unrelated directory and transaction pages are unchanged.

## Command Center scroll restoration

Restored independent desktop scrolling for the Command Center right sidebar. It stays at the top while the main dashboard content scrolls, has a viewport-bounded height, keyboard focus and contained scroll chaining. Mobile retains ordinary page scrolling. Opening a modal also locks the sidebar scroller. No data or permission changes. Targeted lint and typecheck passed; browser interaction remains unverified following the earlier permission decline.

## Separate Command Center panes

The clarified desktop layout replaces the sticky rail with two constrained scrollers. The outer dashboard container no longer scrolls for Command Center pages; the primary column scrolls at the divider and the right column occupies the workspace's far-right edge with a 20rem (320px at default root size) cap. Removed the primary column's max-width so wide screens keep the divider next to the right pane. Small screens keep ordinary stacked page scrolling. Modal scroll locking covers both panes. Hospitality's setup disclosure remains accessible below its Command Center.

Updated the existing fixture and browser assertions for independent scroll positions, far-right alignment, width cap and absence of an outer scrollbar. Typecheck, targeted lint, fixture compilation and diff checks passed. Browser execution remains unverified following the earlier permission decline. No data or authorization changes.
