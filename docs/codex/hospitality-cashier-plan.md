# Apartelle cashier workflow

Goal: vacant room → configured stay package → cash/payment and change → occupied → explicit checkout/vacant. Guest identification is optional. Confirmed periods: 3, 6, 12 hours, daily (24 hours), weekly (7 days). Explicit checkout returns the room to vacant.

Reuse existing rooms/stays, Core invoices/collections/refunds, dialogs, role/branch checks, reports and printing. Add room-admin rate configuration, optional guest association, planned departure and immutable selected-rate snapshot. Core payment rows receive optional cash tender/change fields with exact monetary constraints. New check-in commits occupancy, invoice and payment atomically and handles retries/races; old manual check-in creation is retired, historical stays remain readable and collectible. No automatic checkout or inventory deduction.

Owner/manager alone edit room rates. Cashier can take payment/check in/check out; operational readers receive no ledger details. Financial totals use the charge collected, excluding returned change. UI shows vacant rooms and configured packages, cash amount/change preview and a clear checkout action. Validate local database/RLS, amount/rate tampering, retries, occupancy races, old history, report totals, mobile/desktop and normal signup. Append-only migration, no hosted writes/deployment.
