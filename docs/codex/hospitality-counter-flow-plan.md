# Hospitality counter flow

Simplify existing check-in/checkout forms without changing payment, discount, deposit, occupancy or cleaning rules. Order check-in as stay, payment, shift staff, optional details; checkout as balance/deposit, staff, confirmation. Collapse historical/optional information and remove duplicate totals.

Remember cashier/housekeeper preferences in browser storage, scoped by authenticated user, organization and branch, shared between arrival and departure. Validate remembered IDs against currently available staff; unavailable IDs remain blank. Handle blocked storage, hydration and changes in other tabs. Defaults are preferences only; existing server/database authorization and staff validation remain unchanged. No database migration.

Reuse shared forms, searchable selects, payment calculations and atomic RPCs. Preserve semantic IDs, input values on server errors, cancel behavior and existing request idempotency. Validate preference isolation/stale IDs and payment previews with unit tests, then local check-in/checkout browser flows and responsive layouts. Run tests, lint, types, build and self-review.
