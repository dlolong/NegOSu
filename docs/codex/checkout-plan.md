# Shared checkout execution plan

Goal: existing operation → review charges and accepted products → explicit handover → payment → receipt, across four verticals.

Reuse: appointment service/promo snapshots and appointment payments; issued job invoices and approved estimate lines; hospitality's existing neutral manual invoice; invoice/payment ledgers; inventory products, reservations, reservation operations and movements. No provider charges, procurement, fake appointments, or copied per-vertical carts.

Core boundary: one checkout composition references an existing appointment, an existing invoice, or a real customer for retail-only sales. Products remain draft commercial lines until explicitly finalized into additional neutral invoices. Existing issued bills are never rewritten. Existing payments remain on their original bill. A payment operation resolves all linked bill balances server-side and atomically records allocations through current payment functions. Vertical pages supply authorized contexts and retain their own completion/release policies.

Inventory: accepting a product into checkout reserves tracked inventory atomically through Core Inventory. Changing/removing an unposted line adjusts/releases reservations. Explicit handover consumes the reservation exactly once. Return posts a separate physical return; it never refunds money. Included promo retail products use zero additional charge and separate attribution; supplies and job parts are not sold or deducted again.

Files: append-only migration(s), Core checkout contracts/runtime, contextual dashboard routes and standard dialogs, operational entry links, product-only entry, payment/receipt summary, report extension, focused unit/SQL/concurrency/browser tests.

Security: finance roles manage commercial lines/payment; inventory execution goes through the protected checkout context, with raw checkout reservation mutation unavailable to clients. Every RPC verifies tenant, branch, product, customer, currency and lifecycle. Read access must not expose finance to service-only users. Native exact quantities, authoritative integer minor units, stable retry keys, and context/item locks.

Compatibility: old transactions do not need checkout rows. Existing ledgers and original payment APIs remain. Already posted checkout lines require separate returns/refunds or additional charges; never silently mutate history. Product selling does not complete a visit, release a vehicle, or clear room occupancy.

Validation: unit and database happy/error paths; four context integrations; isolation; exact totals and partial payments; inventory handover retries and last-unit concurrency; receipt/report privacy; desktop and mobile interaction at 375×812, 390×844, 1366×768; lint, typecheck, build. Production migration/deployment are not authorized.
