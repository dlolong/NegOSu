-- Repair the reporting prerequisites missing from some hosted installations.
-- Reuses the canonical 0028 functions; does not replay billing webhooks,
-- subscription-limit triggers, plan prices, or unrelated migration history.
-- Run after 0081. Existing invoice totals/payments are never modified.
alter table public.organization_subscriptions add column if not exists grace_ends_at timestamptz;
create or replace function public.effective_entitlements(p_organization_id uuid)returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('planId',p.id,'planName',p.name,'status',coalesce(s.status,'free'),'limits',p.limits,'features',p.features,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false),'graceEndsAt',s.grace_ends_at)
from public.plans p left join public.organization_subscriptions s on s.organization_id=p_organization_id
where p.id=case when s.status in('trialing','active')or(s.status='past_due' and s.grace_ends_at>now())then s.plan_id else 'free'end
limit 1 $$;
create or replace function public.get_org_entitlements(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$begin if not public.is_org_member(p_organization_id)then raise exception 'Organization not found' using errcode='42501';end if;return public.effective_entitlements(p_organization_id);end$$;
create or replace function public.has_entitlement(p_organization_id uuid,p_feature text)returns boolean language sql stable security definer set search_path=public,pg_temp as $$select coalesce((public.effective_entitlements(p_organization_id)->'features'->>p_feature)::boolean,false)$$;
revoke all on function public.effective_entitlements(uuid),public.has_entitlement(uuid,text),public.get_org_entitlements(uuid)from public,anon;
grant execute on function public.get_org_entitlements(uuid)to authenticated;grant execute on function public.has_entitlement(uuid,text)to authenticated;

alter table public.invoice_items add column if not exists job_order_item_id uuid references public.job_order_items(id) on delete restrict;
alter table public.invoice_items add column if not exists service_id uuid references public.services(id) on delete set null;
alter table public.invoice_items add column if not exists category_name_snapshot text;
alter table public.invoice_items add column if not exists recognized_revenue_centavos bigint not null default 0 check(recognized_revenue_centavos>=0);

create or replace function public.allocate_invoice_revenue(p_invoice_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target_total bigint; base_total bigint; remainder bigint;
begin
  select total_centavos into target_total from public.invoices where id=p_invoice_id;
  if target_total is null then raise exception 'Invoice not found'; end if;
  select coalesce(sum(line_total_centavos),0) into base_total from public.invoice_items where invoice_id=p_invoice_id;
  if base_total=0 then update public.invoice_items set recognized_revenue_centavos=0 where invoice_id=p_invoice_id; return; end if;
  update public.invoice_items set recognized_revenue_centavos=(target_total*line_total_centavos/base_total) where invoice_id=p_invoice_id;
  select target_total-coalesce(sum(recognized_revenue_centavos),0) into remainder from public.invoice_items where invoice_id=p_invoice_id;
  with ranked as(select id,row_number() over(order by ((target_total*line_total_centavos)%base_total) desc,id) n from public.invoice_items where invoice_id=p_invoice_id)
  update public.invoice_items i set recognized_revenue_centavos=i.recognized_revenue_centavos+1 from ranked r where i.id=r.id and r.n<=remainder;
end $$;
revoke all on function public.allocate_invoice_revenue(uuid) from public,anon,authenticated;

create or replace function public.issue_invoice(p_job_id uuid,p_estimate_id uuid default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders;e public.estimates;inv uuid;next_no bigint;yr integer;number_text text;cname text;vname text;subtotal bigint;discount bigint:=0;tax bigint:=0;total bigint;
begin select * into j from public.job_orders where id=p_job_id for update;if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','cashier']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501';end if;if exists(select 1 from public.invoices where job_order_id=j.id)then raise exception 'Job already invoiced';end if;
if p_estimate_id is not null then select * into e from public.estimates where id=p_estimate_id and job_order_id=j.id and status='approved';if e.id is null then raise exception 'Approved estimate required';end if;subtotal:=e.subtotal_centavos;discount:=e.discount_centavos;tax:=e.tax_centavos;total:=e.total_centavos;else select coalesce(sum(line_total_centavos),0)into subtotal from public.job_order_items where job_order_id=j.id and approval_status='approved';total:=subtotal;end if;
select full_name into cname from public.customers where id=j.customer_id;select concat_ws(' ',make,model,plate_number)into vname from public.vehicles where id=j.vehicle_id;yr:=extract(year from now()at time zone 'Asia/Manila');insert into public.invoice_number_counters(branch_id,number_year,last_number)values(j.branch_id,yr,1)on conflict(branch_id,number_year)do update set last_number=public.invoice_number_counters.last_number+1 returning last_number into next_no;number_text:='INV-'||yr||'-'||lpad(next_no::text,6,'0');
insert into public.invoices(organization_id,branch_id,job_order_id,estimate_id,invoice_number,status,customer_name_snapshot,vehicle_snapshot,subtotal_centavos,discount_centavos,tax_centavos,total_centavos,balance_centavos,issued_at,notes,created_by)values(j.organization_id,j.branch_id,j.id,p_estimate_id,number_text,'issued',cname,vname,subtotal,discount,tax,total,total,now(),p_notes,auth.uid())returning id into inv;
if p_estimate_id is not null then insert into public.invoice_items(invoice_id,organization_id,job_order_item_id,service_id,category_name_snapshot,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos)select inv,j.organization_id,ei.job_order_item_id,ji.service_id,coalesce(sc.name,'Uncategorized'),ei.description_snapshot,ei.quantity,ei.unit_price_centavos,ei.discount_centavos,ei.line_total_centavos from public.estimate_items ei left join public.job_order_items ji on ji.id=ei.job_order_item_id left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id where ei.estimate_id=p_estimate_id;
else insert into public.invoice_items(invoice_id,organization_id,job_order_item_id,service_id,category_name_snapshot,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos)select inv,j.organization_id,ji.id,ji.service_id,coalesce(sc.name,'Uncategorized'),ji.service_name_snapshot,ji.quantity,ji.unit_price_centavos,ji.discount_centavos,ji.line_total_centavos from public.job_order_items ji left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id where ji.job_order_id=j.id and ji.approval_status='approved';end if;
perform public.allocate_invoice_revenue(inv);return inv;end $$;

-- Restore only derived line allocations that do not reconcile to invoice totals.
-- Historical lines without a category snapshot remain Uncategorized; do not guess
-- a past category from a customer's current service catalog.
do $$declare invoice_row record;
begin
  for invoice_row in
    select i.id from public.invoices i join public.invoice_items item on item.invoice_id=i.id
    group by i.id,i.total_centavos
    having sum(item.recognized_revenue_centavos)<>i.total_centavos
  loop
    perform public.allocate_invoice_revenue(invoice_row.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
