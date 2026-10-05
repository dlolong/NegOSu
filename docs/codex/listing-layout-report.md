# Listing and detail display update

Shared RecordTable now renders a desktop table and a stacked mobile list from one set of rows and controls. Existing directories inherit the layout. Newer product, promo/service, client purchase, reminder, queue, and payment histories now use the shared table. Separate Edit/actions remain independently operable.

Added or exposed search/status/date controls for catalogs, orders, reminders, inbox, billing history, pets, branches, resources, staff, and catalog histories. Paginated database searches run before range selection and preserve filters in page links. Embedded/secondary lists and bounded work lists explicitly label local search as applying to loaded records. These local controls do not search older pages. Existing transaction forms and short descriptive component lists remain unchanged.

Migration 0122_client_history_filters.sql adds a filtered client purchase history RPC while preserving the original endpoint. Apply it to enable client product-history text/date filters. It retains tenant membership and branch-access checks and restricts execution to authenticated users. No production migration was applied. Other listing changes need no migration.

Self-review covered query escaping, date boundaries, pagination, one set of action IDs, empty/error states, branch and tenant filters, and preserved form actions. A queue filter was corrected to use fetched entries because queue_directory does not expose status. New tests cover filter-before-pagination, literal search text, date boundaries, and displayed-text-only local searches. SQL tests cover filtered results, wildcard literals, offsets, and denied tenant access. Browser tests cover mobile/desktop layout and filtering.

Listing validation: full lint passed; 532 unit tests passed after updating an obsolete mobile-breakpoint assertion; webpack production build passed after generated Next.js caches were cleared to recover disk space. Updated browser fixtures compiled. SQL tests could not run because the local Docker database is stopped. Browser execution/visual verification remain unverified.

Follow-up display request: service/treatment details now use the same PageHeader, max-width, image/details card, compact facts, availability controls, and history arrangement as product details. Automotive-only vehicle pricing remains available. Typecheck, targeted lint, and eight service-photo/catalog-history tests passed for this layout refinement. No additional migration is needed for the detail layout.
