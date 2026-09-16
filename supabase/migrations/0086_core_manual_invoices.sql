-- Neutral manual bills reuse the existing invoice/item/payment ledger.
-- Existing job-backed invoices and the five-argument payment API remain compatible.
alter table public.invoices alter column job_order_id drop not null;
alter table public.invoices alter column vehicle_snapshot set default '';
alter table public.invoices add column billing_kind text not null default 'job';
alter table public.invoices add constraint invoices_billing_kind_check check (
 (billing_kind='job' and job_order_id is not null) or
 (billing_kind='manual' and job_order_id is null and estimate_id is null));
alter table public.invoices add constraint invoices_tenant_branch_key unique(organization_id,branch_id,id);
alter table public.invoice_items add column request_key uuid;
create unique index invoice_item_request_key on public.invoice_items(invoice_id,request_key) where request_key is not null;
alter table public.payments add column invoice_idempotency_key uuid;
create unique index payments_invoice_request_key on public.payments(invoice_id,invoice_idempotency_key) where invoice_idempotency_key is not null;

create or replace function public.enforce_invoice_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare j public.job_orders; e public.estimates;
begin
 if not exists(select 1 from public.branches where id=new.branch_id and organization_id=new.organization_id) then raise exception 'Invoice branch mismatch'; end if;
 if new.billing_kind='manual' then return new; end if;
 select * into j from public.job_orders where id=new.job_order_id;
 if j.id is null or j.organization_id<>new.organization_id or j.branch_id<>new.branch_id then raise exception 'Invoice tenant mismatch'; end if;
 if new.estimate_id is not null then select * into e from public.estimates where id=new.estimate_id;
 if e.id is null or e.organization_id<>new.organization_id or e.job_order_id<>new.job_order_id then raise exception 'Invoice estimate mismatch'; end if; end if;
 return new;
end $$;
create or replace function public.enforce_payment_invoice_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare i public.invoices;
begin if new.invoice_id is not null then select * into i from public.invoices where id=new.invoice_id;
 if i.id is null or i.organization_id<>new.organization_id or i.branch_id<>new.branch_id or i.job_order_id is distinct from new.job_order_id
 or new.currency is distinct from (select currency from public.organizations where id=i.organization_id)
 then raise exception 'Payment invoice tenant or currency mismatch'; end if;
 end if; return new; end $$;
-- Items had only a tenant policy; keep financial detail branch-scoped as well.
create policy invoice_items_branch_scope on public.invoice_items as restrictive for select to authenticated
 using(exists(select 1 from public.invoices i where i.id=invoice_id and public.can_access_branch(i.organization_id,i.branch_id)));

-- Internal Core primitive. Vertical transactions own the billable context.
create function public.create_manual_invoice(p_org uuid,p_branch uuid,p_customer_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare bill uuid:=gen_random_uuid();
begin
 if not public.has_org_role(p_org,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then raise exception 'Finance access required' using errcode='42501'; end if;
 insert into public.invoices(id,organization_id,branch_id,billing_kind,invoice_number,status,customer_name_snapshot,subtotal_centavos,total_centavos,balance_centavos,issued_at,created_by)
 values(bill,p_org,p_branch,'manual','BILL-'||upper(replace(bill::text,'-','')),'issued',p_customer_name,0,0,0,now(),auth.uid());
 return bill;
end $$;
create function public.add_manual_invoice_charge(p_invoice uuid,p_description text,p_quantity integer,p_unit_centavos bigint,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare bill public.invoices; item public.invoice_items; amount bigint; new_total bigint;
begin
 select * into bill from public.invoices where id=p_invoice for update;
 if bill.id is null or bill.billing_kind<>'manual' or not public.has_org_role(bill.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(bill.organization_id,bill.branch_id) then raise exception 'Bill unavailable' using errcode='42501'; end if;
 if p_request is null or p_quantity is null or p_quantity not between 1 and 1000 or p_unit_centavos is null or p_unit_centavos not between 0 and 10000000000 or nullif(trim(p_description),'') is null or char_length(p_description)>200 or bill.status='void' then raise exception 'Invalid charge' using errcode='22023'; end if;
 select * into item from public.invoice_items where invoice_id=p_invoice and request_key=p_request;
 if item.id is not null then
 if item.description_snapshot<>trim(p_description) or item.quantity<>p_quantity or item.unit_price_centavos<>p_unit_centavos then raise exception 'Request key already used with different charge' using errcode='22023'; end if;
 return item.id; end if;
 amount:=p_quantity::bigint*p_unit_centavos; new_total:=bill.total_centavos+amount;
 if new_total>1000000000000 then raise exception 'Bill limit exceeded' using errcode='22023'; end if;
 insert into public.invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos,request_key)
 values(bill.id,bill.organization_id,trim(p_description),p_quantity,p_unit_centavos,amount,p_request) returning * into item;
 update public.invoices set subtotal_centavos=new_total,total_centavos=new_total,balance_centavos=new_total-paid_centavos,
 status=case when new_total=paid_centavos then 'paid'::public.invoice_status when paid_centavos>0 then 'partially_paid'::public.invoice_status else 'issued'::public.invoice_status end where id=bill.id;
 return item.id;
end $$;
revoke all on function public.create_manual_invoice(uuid,uuid,text),public.add_manual_invoice_charge(uuid,text,integer,bigint,uuid) from public,anon,authenticated;

create function public.record_invoice_collection(p_invoice_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_request_key uuid,p_reference text default null,p_notes text default null,p_paid_date date default null,p_currency text default 'PHP') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.invoices; existing public.payments; pid uuid; collected_at timestamptz; tz text; curr text;
begin
 select * into i from public.invoices where id=p_invoice_id for update;
 if i.id is null or not public.has_org_role(i.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(i.organization_id,i.branch_id) then raise exception 'Invoice not found' using errcode='42501'; end if;
 select b.timezone,o.currency into tz,curr from public.branches b join public.organizations o on o.id=b.organization_id where b.id=i.branch_id;
 if p_request_key is null or p_currency is distinct from curr or p_amount_centavos is null or p_amount_centavos<=0 or p_method is null or char_length(coalesce(p_reference,''))>200 or char_length(coalesce(p_notes,''))>2000 or p_paid_date>(now() at time zone tz)::date or p_paid_date<(i.created_at at time zone tz)::date then raise exception 'Invalid payment details' using errcode='22023'; end if;
 select * into existing from public.payments where invoice_id=i.id and invoice_idempotency_key=p_request_key;
 if existing.id is not null then
 if existing.amount_centavos<>p_amount_centavos or existing.method<>p_method or existing.reference is distinct from nullif(trim(p_reference),'') or existing.notes is distinct from nullif(trim(p_notes),'') or (p_paid_date is not null and (existing.paid_at at time zone tz)::date<>p_paid_date) then raise exception 'Request key already used with different payment' using errcode='22023'; end if;
 return existing.id; end if;
 if i.status not in ('issued','partially_paid') or p_amount_centavos>i.balance_centavos then raise exception 'Payment exceeds remaining balance or bill is closed' using errcode='22023'; end if;
 collected_at:=case when p_paid_date is null or p_paid_date=(now() at time zone tz)::date then now() else (p_paid_date+time '12:00') at time zone tz end;
 insert into public.payments(organization_id,branch_id,job_order_id,invoice_id,amount_centavos,currency,method,status,reference,paid_at,notes,received_by,created_by,invoice_idempotency_key)
 values(i.organization_id,i.branch_id,i.job_order_id,i.id,p_amount_centavos,curr,p_method,'paid',nullif(trim(p_reference),''),collected_at,nullif(trim(p_notes),''),auth.uid(),auth.uid(),p_request_key) returning id into pid;
 update public.invoices set paid_centavos=paid_centavos+p_amount_centavos,balance_centavos=balance_centavos-p_amount_centavos,status=case when balance_centavos=p_amount_centavos then 'paid'::public.invoice_status else 'partially_paid'::public.invoice_status end where id=i.id;
 return pid;
end $$;
revoke all on function public.record_invoice_collection(uuid,bigint,public.payment_method,uuid,text,text,date,text) from public,anon;
grant execute on function public.record_invoice_collection(uuid,bigint,public.payment_method,uuid,text,text,date,text) to authenticated;
-- Old clients continue to work; new clients supply a stable request key.
create or replace function public.record_invoice_payment(p_invoice_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_reference text default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return public.record_invoice_collection(p_invoice_id,p_amount_centavos,p_method,gen_random_uuid(),p_reference,p_notes,null,(select o.currency from public.invoices i join public.organizations o on o.id=i.organization_id where i.id=p_invoice_id));
exception when sqlstate '22023' then raise exception 'Invalid payment amount';
end $$;
