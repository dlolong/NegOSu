-- Repair installations that applied the initial billing-orders schema before
-- reconciliation tracking was included. Preserve all orders and their statuses.
alter table public.billing_orders
 add column if not exists checkout_closed_at timestamptz,
 add column if not exists last_checked_at timestamptz;

notify pgrst,'reload schema';
