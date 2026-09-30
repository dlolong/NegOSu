# Compact search and filters

Replaced expanded search/filter boxes with shared icon controls across customers /
clients, vehicles and customer lookup, job orders, appointments (including pet
care), booking requests, queue, reminders, service catalog, inventory, payments,
reports, hospitality guests and rooms. Hospitality report, payment and history
filters now consistently use a native popover.

`components/compact-filters.tsx` owns disclosure, focus and one GET form. Pages
retain their original input names, IDs, default values, hidden view parameters,
form destinations, status choices and data queries. `FilterPopover` gained an
optional icon-only trigger; its default API remains compatible. Existing filter
box wrappers no longer add decorative padding around the collapsed toolbar.

Search reveals just the input, supports the mobile Search key and submits with
Enter. Escape returns focus to the icon without clearing the draft. Applied
searches retain a concise summary; the existing payment clear action stays
available. Filter panels support native outside-click/Escape dismissal and the
existing close button. Hidden invalid fields are revealed for native validation.

No database, authorization, RLS, tenant/branch scope, or mutation changes were
made. Earlier Settings and image-upload changes remain separate work.

Validation:

- 460 unit tests passed using Node 24 `node --import tsx --test tests/*.test.ts`.
- Lint and typecheck passed.
- Production build passed with `npm run build -- --webpack` inside the sandbox.
- Compact filters, hospitality payment filters and inventory browser fixtures
  compile with application CSS.
- Browser execution was blocked at Chrome startup; escalation was declined.
  Browser interactions and visual layout are not claimed as verified.

Browser regression tests cover initial icon state, input focus, Enter submission,
preserved search/filter/view values, pagination reset, Escape/close behavior,
popover positioning without page movement, filter-only/search-only modes, and
validation recovery. Existing inventory, payment search and appointment-date
tests were updated to open the relevant controls first.

Before release, run `e2e/compact-filters.spec.ts`, `e2e/payment-filters.spec.ts`,
and `e2e/inventory.spec.ts` on desktop and phone viewports. Verify active query
values, resetting filters, tab preservation and restricted branch results using
the existing authenticated smoke tests in a development environment.
