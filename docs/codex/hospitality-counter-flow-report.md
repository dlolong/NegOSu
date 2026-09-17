# Hospitality counter flow

## Implementation

Check-in is organized into stay selection, payment and change, then shift staff. Optional guest details, occupancy adjustments, notes and paper receipt are collapsed. The payment preview shows the total to collect and change, removing repeated charge/deposit totals. Existing final-price, discount-card, refundable-deposit and extension rules remain available.

Checkout shows the remaining balance and a Record payment shortcut, followed by deposit return, then staff confirmation. Checking out with debt still requires explicit acknowledgement; refund confirmation is still required for a held deposit. Completed checkout sends the room to Cleaning. The stay page puts the paid period and current financial status ahead of collapsed historical check-in/payment/staff details.

Cashier and housekeeper preferences are saved immediately when changed, scoped by signed-in user, business and branch and shared between check-in and checkout. They survive browser refresh and successful form resets, and can be changed for a new shift. Cancel retains the preference but never submits the transaction. Unavailable/inactive staff are filtered out. Blocked storage falls back to memory for the current app session.

## Files and boundaries

- Added `components/hospitality/check-out-form.tsx` and `modules/hospitality/shift-preferences.ts`.
- Updated check-in, settlement and shift fields, Rooms and stay details, and the shared searchable-select's optional reset-preservation behavior (default behavior elsewhere is unchanged).
- Updated `docs/HOSPITALITY.md`, unit tests and the Hospitality browser suite.

No new database migration, RLS change, financial mutation logic or server action is needed for this phase. Existing RPCs still authorize the actual user, validate active staff and branch ownership, preserve immutable staff snapshots and enforce payment totals, refunds, concurrency and idempotency. Browser preferences contain staff IDs only and cannot grant authority or alter a past stay. Previously pending repository work is preserved.

## Validation and self-review

- `npm test`: 437 passed, including 11 new preference tests covering user/workspace/branch isolation, stale IDs, malformed data and cleared fields.
- `npm run check`: lint, typecheck and production build passed.
- Final typecheck passed after adding browser coverage.
- Hospitality browser suite: 23 passed across desktop and 320/390-pixel mobile layouts; four duplicate desktop-only scenarios skipped. Coverage exercises refresh/form-reset persistence, check-in → checkout → next check-in reuse, stale selections, unavailable storage, existing financial workflows, cleaning, permissions, cancellation and responsive dialogs.

Desktop/mobile screenshots were inspected and overflow checks passed. Targeted final lint and `git diff --check` passed.

Self-review covered storage isolation, hydration, failed storage writes, stale staff, form reset behavior, no invented permissions, unchanged refund/debt acknowledgement, responsive forms and preservation of historical records. No known blocker/high finding. No production data or live payment provider was used. The local Next server still emits its previously observed navigation-cancellation “destination stream closed early” message; browser assertions pass.

## Scope and rollout

Preferences are local to this browser and account/branch, not synchronized across devices. Clearing site data removes them; blocked persistent storage cannot survive a full reload. Cancelled selections are retained by design as shift preferences. Separate staffing schedules, timeclock/payroll and historical reassignment are not included.

Deploy through the normal reviewed release process. This phase needs no new migration; previously pending Hospitality migrations remain prerequisites for the earlier pricing/staff-attribution work.
