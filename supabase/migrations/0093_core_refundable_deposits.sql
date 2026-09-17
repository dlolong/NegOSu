-- Refundable security deposits are liabilities, separate from invoice revenue.
alter table public.invoices add column external_receipt_number text check(char_length(external_receipt_number)<=80);
alter table public.payments add column receipt_number text check(char_length(receipt_number)<=80);
alter table public.payments add column cash_deposit_centavos bigint not null default 0 check(cash_deposit_centavos>=0);
alter table public.payments drop constraint payments_cash_change_check;
alter table public.payments add constraint payments_cash_change_check check(
 (cash_tendered_centavos is null and cash_change_centavos is null and cash_deposit_centavos=0) or
 (cash_tendered_centavos is not null and cash_change_centavos is not null and method='cash'
 and cash_change_centavos>=0 and cash_tendered_centavos=amount_centavos+cash_deposit_centavos+cash_change_centavos));
create table public.invoice_deposits(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,invoice_id uuid not null unique,
 amount_centavos bigint not null check(amount_centavos between 1 and 10000000000),currency text not null check(char_length(currency)=3),
 method public.payment_method not null,reference text check(char_length(reference)<=200),request_key uuid not null,
 received_at timestamptz not null default now(),received_by uuid references auth.users(id),
 refunded_at timestamptz,refunded_by uuid references auth.users(id),refund_method public.payment_method,refund_reference text check(char_length(refund_reference)<=200),
 foreign key(organization_id,branch_id,invoice_id) references public.invoices(organization_id,branch_id,id) on delete restrict,
 check((refunded_at is null and refunded_by is null and refund_method is null and refund_reference is null) or (refunded_at is not null and refund_method is not null and refunded_at>=received_at)));
create index invoice_deposits_branch on public.invoice_deposits(organization_id,branch_id);
alter table public.invoice_deposits enable row level security;
revoke all on public.invoice_deposits from anon,authenticated;
grant select on public.invoice_deposits to authenticated;
create policy invoice_deposits_read on public.invoice_deposits for select to authenticated using(
 public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[])
 and public.can_access_branch(organization_id,branch_id)
 and exists(select 1 from public.invoices i where i.id=invoice_id));
create trigger invoice_deposits_audit after insert or update on public.invoice_deposits for each row execute function public.audit_job_finance_change();

create function public.hold_invoice_deposit(p_invoice uuid,p_amount bigint,p_method public.payment_method,p_reference text,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare bill public.invoices; deposit public.invoice_deposits; curr text;
begin
 select * into bill from public.invoices where id=p_invoice for update;
 if bill.id is null or not public.has_org_role(bill.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(bill.organization_id,bill.branch_id) then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_amount is null or p_amount not between 1 and 10000000000 or p_method is null or p_request is null or char_length(coalesce(p_reference,''))>200 then raise exception 'Invalid deposit' using errcode='22023'; end if;
 select * into deposit from public.invoice_deposits where invoice_id=p_invoice;
 if deposit.id is not null then
  if deposit.request_key<>p_request or deposit.amount_centavos<>p_amount or deposit.method<>p_method or deposit.reference is distinct from nullif(trim(p_reference),'') then raise exception 'Deposit already recorded' using errcode='22023'; end if;
  return deposit.id;
 end if;
 select currency into curr from public.organizations where id=bill.organization_id;
 insert into public.invoice_deposits(organization_id,branch_id,invoice_id,amount_centavos,currency,method,reference,request_key,received_by)
 values(bill.organization_id,bill.branch_id,bill.id,p_amount,curr,p_method,nullif(trim(p_reference),''),p_request,auth.uid()) returning id into deposit.id;
 return deposit.id;
end $$;
create function public.refund_invoice_deposit(p_invoice uuid,p_method public.payment_method,p_reference text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare bill public.invoices; deposit public.invoice_deposits;
begin
 select * into bill from public.invoices where id=p_invoice for update;
 if bill.id is null or not public.has_org_role(bill.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(bill.organization_id,bill.branch_id) then raise exception 'Finance access required' using errcode='42501'; end if;
 select * into deposit from public.invoice_deposits where invoice_id=p_invoice for update;
 if deposit.id is null or p_method is null or char_length(coalesce(p_reference,''))>200 then raise exception 'Invalid deposit refund' using errcode='22023'; end if;
 if deposit.refunded_at is not null then
  if deposit.refund_method<>p_method or deposit.refund_reference is distinct from nullif(trim(p_reference),'') then raise exception 'Deposit already refunded' using errcode='22023'; end if;
  return;
 end if;
 update public.invoice_deposits set refunded_at=now(),refunded_by=auth.uid(),refund_method=p_method,refund_reference=nullif(trim(p_reference),'') where id=deposit.id;
end $$;
revoke all on function public.hold_invoice_deposit(uuid,bigint,public.payment_method,text,uuid),public.refund_invoice_deposit(uuid,public.payment_method,text) from public,anon,authenticated;

create function public.set_invoice_external_receipt(p_invoice uuid,p_receipt text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare bill public.invoices;
begin
 select * into bill from public.invoices where id=p_invoice for update;
 if bill.id is null or not public.has_org_role(bill.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(bill.organization_id,bill.branch_id) then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 if char_length(coalesce(p_receipt,''))>80 then raise exception 'Invalid receipt number' using errcode='22023'; end if;
 update public.invoices set external_receipt_number=nullif(trim(p_receipt),'') where id=p_invoice;
end $$;
revoke all on function public.set_invoice_external_receipt(uuid,text) from public,anon;
grant execute on function public.set_invoice_external_receipt(uuid,text) to authenticated;

create function public.record_invoice_collection_with_receipt(p_invoice_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_request_key uuid,p_reference text,p_notes text,p_paid_date date,p_currency text,p_receipt_number text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.payments; pid uuid;
begin
 -- Core collection performs the authoritative invoice/role/branch validation.
 perform 1 from public.invoices where id=p_invoice_id for update;
 if char_length(coalesce(p_receipt_number,''))>80 then raise exception 'Invalid receipt number' using errcode='22023'; end if;
 select * into existing from public.payments where invoice_id=p_invoice_id and invoice_idempotency_key=p_request_key;
 pid:=public.record_invoice_collection(p_invoice_id,p_amount_centavos,p_method,p_request_key,p_reference,p_notes,p_paid_date,p_currency);
 if existing.id is not null and existing.receipt_number is distinct from nullif(trim(p_receipt_number),'') then raise exception 'Payment request already used with a different receipt' using errcode='22023'; end if;
 update public.payments set receipt_number=nullif(trim(p_receipt_number),'') where id=pid;
 return pid;
end $$;
revoke all on function public.record_invoice_collection_with_receipt(uuid,bigint,public.payment_method,uuid,text,text,date,text,text) from public,anon;
grant execute on function public.record_invoice_collection_with_receipt(uuid,bigint,public.payment_method,uuid,text,text,date,text,text) to authenticated;
