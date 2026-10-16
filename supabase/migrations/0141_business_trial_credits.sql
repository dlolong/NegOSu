-- One lifetime grant per business. Private tables are accessed only through checked RPCs.
begin;
create table public.trial_credit_accounts (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 remaining integer not null default 100 check(remaining between 0 and 100)
);
create table public.trial_credit_operations (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 request_id uuid not null, actor_id uuid not null, feature text not null check(feature in('advanced_report','csv_export','image_upload')),
 payload jsonb not null, cost integer not null default 0 check(cost in(0,1)),
 completed boolean not null default false, result jsonb, branch_ids uuid[] not null default '{}',
 actor_role public.organization_role not null, created_at timestamptz not null default now(),
 primary key(organization_id,request_id)
);
create index trial_credit_history on public.trial_credit_operations(organization_id,actor_id,created_at desc);
-- No browser-set GUC can activate an entitlement. Only the report wrapper writes this table.
create table public.trial_report_context (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 transaction_id bigint not null, primary key(organization_id,transaction_id)
);
alter table public.trial_credit_accounts enable row level security;
alter table public.trial_credit_operations enable row level security;
alter table public.trial_report_context enable row level security;
revoke all on public.trial_credit_accounts,public.trial_credit_operations,public.trial_report_context from public,anon,authenticated;
create or replace function public.plan_entitlements(p_organization_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('planId',p.id,'planName',p.name,'status',coalesce(s.status,'free'),'limits',p.limits,'features',p.features,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false),'graceEndsAt',s.grace_ends_at)
from public.plans p left join public.organization_subscriptions s on s.organization_id=p_organization_id
where p.id=case when (s.provider in('paymongo','manual') and s.status='active' and s.current_period_end>now()) or (s.provider is distinct from 'paymongo' and s.provider is distinct from 'manual' and (s.status in('trialing','active')or(s.status='past_due' and s.grace_ends_at>now()))) then s.plan_id else 'free'end limit 1 $$;

revoke all on function public.plan_entitlements(uuid) from public,anon,authenticated;
create or replace function public.effective_entitlements(p_organization_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select case when exists(select 1 from public.trial_report_context where organization_id=p_organization_id and transaction_id=txid_current())
 then jsonb_set(public.plan_entitlements(p_organization_id),'{features,advanced_reports}','true') else public.plan_entitlements(p_organization_id) end
$$;
revoke all on function public.effective_entitlements(uuid) from public,anon,authenticated;
create or replace function public.get_org_entitlements(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_org_member(p_organization_id) then raise exception 'Organization not found' using errcode='42501'; end if;
 return public.plan_entitlements(p_organization_id)||jsonb_build_object('trialCredits',jsonb_build_object('initial',100,'remaining',coalesce((select remaining from public.trial_credit_accounts where organization_id=p_organization_id),100)));
end $$;
create or replace function public.client_purchase_report_data(
 p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,
 p_client_search text default '',p_item_search text default '',p_kind text default 'all',p_page integer default 1,p_all_rows boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; industry_key text;
begin
 if auth.uid() is null then raise exception 'Reporting access required' using errcode='42501'; end if;
 if not public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id) then
  raise exception 'Advanced reports require an eligible plan' using errcode='42501';
 end if;
 if p_start_date is null or p_end_date is null or not isfinite(p_start_date) or not isfinite(p_end_date)
 or p_page is null or p_page not between 1 and 100000 or p_kind is null or p_kind not in ('all','service','product','other')
 or p_client_search is null or char_length(p_client_search)>120 or p_item_search is null or char_length(p_item_search)>120 then
  raise exception 'Invalid report filters' using errcode='22023';
 end if;
 select industry into industry_key from public.organizations where id=p_organization_id;
 with branches as materialized (
  select b.id,b.name,b.timezone from public.branches b where b.organization_id=p_organization_id
  and (p_branch_id is null or b.id=p_branch_id) and public.can_access_branch(p_organization_id,b.id)
 ), appointments as materialized (
  select a.*,b.name branch_name,b.timezone,(coalesce(a.starts_at,a.created_at) at time zone b.timezone)::date report_day
  from public.appointments a join branches b on b.id=a.branch_id
  where a.organization_id=p_organization_id and industry_key in ('salon','pet_care') and a.status='completed'
  and coalesce(a.starts_at,a.created_at)>=p_start_date::timestamp at time zone b.timezone
  and coalesce(a.starts_at,a.created_at)<(p_end_date+1)::timestamp at time zone b.timezone
 ), bills as materialized (
  select i.*,b.name branch_name,b.timezone,(i.issued_at at time zone b.timezone)::date report_day,
   ci.checkout_id retail_checkout_id,coalesce(j.id,pj.id) staff_job_id,pa.id staff_appointment_id,coalesce(stay.id,parent_stay.id) staff_stay_id,
   coalesce(j.customer_id,c.customer_id,stay.guest_id,pj.customer_id,pa.customer_id,parent_stay.guest_id) client_id
  from public.invoices i join branches b on b.id=i.branch_id
  left join public.checkout_invoices ci on ci.invoice_id=i.id
  left join public.checkouts source_checkout on source_checkout.source_invoice_id=i.id and source_checkout.organization_id=i.organization_id and source_checkout.branch_id=i.branch_id
  left join public.checkouts c on c.id=coalesce(ci.checkout_id,source_checkout.id) and c.organization_id=i.organization_id and c.branch_id=i.branch_id
  left join public.job_orders j on j.id=i.job_order_id and j.organization_id=i.organization_id and j.branch_id=i.branch_id
  left join public.hospitality_stay_bills sb on sb.invoice_id=i.id and sb.organization_id=i.organization_id and sb.branch_id=i.branch_id
  left join public.hospitality_stays stay on stay.id=sb.stay_id and stay.organization_id=i.organization_id and stay.branch_id=i.branch_id
  left join public.invoices parent on parent.id=c.source_invoice_id and parent.organization_id=i.organization_id and parent.branch_id=i.branch_id
  left join public.job_orders pj on pj.id=parent.job_order_id and pj.organization_id=i.organization_id and pj.branch_id=i.branch_id
  left join public.appointments pa on pa.id=c.appointment_id and pa.organization_id=i.organization_id and pa.branch_id=i.branch_id
  left join public.hospitality_stay_bills psb on psb.invoice_id=parent.id and psb.organization_id=i.organization_id and psb.branch_id=i.branch_id
  left join public.hospitality_stays parent_stay on parent_stay.id=psb.stay_id and parent_stay.organization_id=i.organization_id and parent_stay.branch_id=i.branch_id
  where i.organization_id=p_organization_id and i.status in ('issued','partially_paid','paid')
  and i.issued_at>=p_start_date::timestamp at time zone b.timezone and i.issued_at<(p_end_date+1)::timestamp at time zone b.timezone
  and (industry_key not in ('salon','pet_care') or (ci.checkout_id is not null and c.id is not null))
 ), appointment_payments as (
  select p.appointment_id,sum(p.amount_centavos)::bigint paid
  from public.payments p join appointments a on a.id=p.appointment_id and a.branch_id=p.branch_id
  where p.organization_id=p_organization_id and p.status='paid' group by p.appointment_id
 ), records as materialized (
  select 'appointment:'||a.id record_key,a.customer_id client_id,a.customer_id::text client_key,
   cust.full_name client_name,a.branch_name,a.report_day,a.expected_total_centavos total,
   coalesce(p.paid,0)::bigint paid,greatest(a.expected_total_centavos-coalesce(p.paid,0),0)::bigint balance
  from appointments a join public.customers cust on cust.id=a.customer_id and cust.organization_id=p_organization_id
  left join appointment_payments p on p.appointment_id=a.id
  union all
  select 'invoice:'||i.id,cust.id,coalesce(cust.id::text,'unlinked:'||i.id),coalesce(cust.full_name,i.customer_name_snapshot),i.branch_name,i.report_day,i.total_centavos,i.paid_centavos,i.balance_centavos
  from bills i left join public.customers cust on cust.id=i.client_id and cust.organization_id=p_organization_id
 ), items as materialized (
  select 'appointment:'||a.id record_key,'service'::text kind,s.service_name_snapshot name,1::numeric quantity,''::text unit,false included
  from appointments a join public.appointment_services s on s.appointment_id=a.id
  union all
  select 'invoice:'||i.id,case when i.retail_checkout_id is not null then 'product' when item.service_id is not null or ji.service_id is not null then 'service' else 'other' end,
   item.description_snapshot,item.quantity,''::text,false
  from bills i join public.invoice_items item on item.invoice_id=i.id and item.organization_id=p_organization_id
  left join public.job_order_items ji on ji.id=item.job_order_item_id and ji.organization_id=p_organization_id and ji.job_order_id=i.job_order_id
  union all
  -- Fulfilled promo products are included in the appointment price, not new sales.
  select 'appointment:'||a.id,'product',l.name,l.handed_over,l.unit,true
  from appointments a join public.checkouts c on c.appointment_id=a.id and c.organization_id=p_organization_id and c.branch_id=a.branch_id
  join public.checkout_lines l on l.checkout_id=c.id
  where l.included_key is not null and l.removed_at is null and l.handed_over>0
 ), matched as materialized (
  select r.* from records r
  where strpos(lower(r.client_name),lower(btrim(p_client_search)))>0
  and (p_kind='all' and btrim(p_item_search)='' or exists(
   select 1 from items x where x.record_key=r.record_key and (p_kind='all' or x.kind=p_kind) and strpos(lower(x.name),lower(btrim(p_item_search)))>0
  ))
 ), clients as materialized (
  select client_key,client_id,client_name,max(report_day) last_activity,count(*) records,
   sum(total)::bigint total,sum(paid)::bigint paid,sum(balance)::bigint balance,
   array_agg(distinct branch_name order by branch_name) branches
  from matched group by client_key,client_id,client_name
 ), page_clients as (
  select * from clients order by lower(client_name),client_key limit case when p_all_rows then null else 50 end offset case when p_all_rows then 0 else (p_page-1)*50 end
 ), work_targets as (
  select 'appointment:'||a.id record_key,a.branch_id,'appointment'::text kind,a.id target_id from appointments a
  union all
  select 'invoice:'||i.id,i.branch_id,t.kind,t.target_id from bills i
  cross join lateral(values('job'::text,i.staff_job_id),('appointment',i.staff_appointment_id),('stay',i.staff_stay_id)) t(kind,target_id)
  where t.target_id is not null
 ), client_staff as (
  -- Reuse the canonical participation view (including historical name snapshots).
  -- Restrict it to matched records on this page, with explicit tenant/branch keys.
  select r.client_key,w.staff_id,max(w.staff_name) staff_name
  from matched r join page_clients c on c.client_key=r.client_key
  join work_targets t on t.record_key=r.record_key
  join public.staff_work_participation w on w.organization_id=p_organization_id and w.branch_id=t.branch_id and w.kind=t.kind and w.target_id=t.target_id
  where w.staff_id is not null and w.source<>'scheduled_staff'
  group by r.client_key,w.staff_id
 ), item_totals as (
  select r.client_key,x.kind,x.name,x.unit,x.included,sum(x.quantity) quantity
  from matched r join page_clients c on c.client_key=r.client_key join items x on x.record_key=r.record_key
  group by r.client_key,x.kind,x.name,x.unit,x.included
 )
 select jsonb_build_object(
  'count',(select count(*) from clients),
  'summary',jsonb_build_object('records',(select count(*) from matched),'total',(select coalesce(sum(total),0) from matched),'paid',(select coalesce(sum(paid),0) from matched),'balance',(select coalesce(sum(balance),0) from clients)),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('key',c.client_key,'clientId',c.client_id,'name',c.client_name,'lastActivity',c.last_activity,'records',c.records,'branches',c.branches,'total',c.total,'paid',c.paid,'balance',c.balance,
   'staff',coalesce((select jsonb_agg(jsonb_build_object('id',s.staff_id,'name',s.staff_name) order by s.staff_name,s.staff_id) from client_staff s where s.client_key=c.client_key),'[]'::jsonb),
   'items',coalesce((select jsonb_agg(jsonb_build_object('kind',x.kind,'name',x.name,'quantity',x.quantity,'unit',x.unit,'included',x.included) order by x.kind,x.name,x.unit,x.included) from item_totals x where x.client_key=c.client_key),'[]'::jsonb)
  ) order by lower(c.client_name),c.client_key) from page_clients c),'[]'::jsonb)
 ) into result;
 return result;
end $$;

revoke all on function public.client_purchase_report_data(uuid,date,date,uuid,text,text,text,integer,boolean) from public,anon,authenticated;
create or replace function public.get_client_purchase_report(
 p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,
 p_client_search text default '',p_item_search text default '',p_kind text default 'all',p_page integer default 1
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.client_purchase_report_data(p_organization_id,p_start_date,p_end_date,p_branch_id,p_client_search,p_item_search,p_kind,p_page,false)
$$;

-- Each report snapshot is private to its requesting user. Permission/branch changes invalidate access.
create function public.read_credit_report(p_org uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; member_role public.organization_role;
begin
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 if not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request and actor_id=auth.uid() and completed and feature in('advanced_report','csv_export');
 if not found or member_role is distinct from op.actor_role or exists(select 1 from unnest(op.branch_ids) b where not public.can_access_branch(p_org,b)) then
  raise exception 'Saved report not available' using errcode='42501';
 end if;
 if exists(select 1 from public.organizations where id=p_org and financial_report_roles_only)
 and not public.has_org_role(p_org,array['owner','manager','advisor','cashier']::public.organization_role[]) then
  raise exception 'Financial reporting access required' using errcode='42501';
 end if;
 if op.payload->>'section' in('inventory','movements') and not public.has_permission(p_org,'inventory.manage') then raise exception 'Inventory access required' using errcode='42501'; end if;
 return jsonb_build_object('id',op.request_id,'payload',op.payload,'report',op.result,'cost',op.cost,'createdAt',op.created_at,'remaining',coalesce((select remaining from public.trial_credit_accounts where organization_id=p_org),100));
end $$;
create function public.generate_credit_report(p_org uuid,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; balance integer; charge integer; result jsonb; revenue jsonb;
 start_day date; end_day date; branch uuid; report_kind text; action_kind text; industry_key text; scope_ids uuid[]; member_role public.organization_role;
begin
 if auth.uid() is null or not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 if p_request is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>2048 then raise exception 'Invalid report request' using errcode='22023'; end if;
 start_day:=(p_payload->>'start')::date; end_day:=(p_payload->>'end')::date; branch:=(p_payload->>'branch')::uuid;
 report_kind:=p_payload->>'kind'; action_kind:=p_payload->>'action';
 if start_day is null or end_day is null or not isfinite(start_day) or not isfinite(end_day) or end_day<start_day or end_day-start_day>731
 or report_kind is null or report_kind not in('clients','overview','hospitality') or action_kind is null or action_kind not in('advanced_report','csv_export')
 or coalesce(length(p_payload->>'client'),0)>120 or coalesce(length(p_payload->>'item'),0)>120 then raise exception 'Invalid report filters' using errcode='22023'; end if;
 select industry into industry_key from public.organizations where id=p_org;
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 if (report_kind='hospitality' and industry_key<>'hospitality') or (report_kind='overview' and industry_key='hospitality') then raise exception 'Invalid report type' using errcode='22023'; end if;
 -- One row lock serializes all spending for this business, including image finalization.
 insert into public.trial_credit_accounts(organization_id) values(p_org) on conflict do nothing;
 select remaining into balance from public.trial_credit_accounts where organization_id=p_org for update;
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request;
 if found then
  if op.actor_id<>auth.uid() or op.payload<>p_payload or op.feature<>action_kind then raise exception 'Request key already used' using errcode='22023'; end if;
  return public.read_credit_report(p_org,p_request);
 end if;
 charge:=case when coalesce((public.plan_entitlements(p_org)->'features'->>'advanced_reports')::boolean,false) then 0 else 1 end;
 if coalesce((p_payload->>'maxCost')::integer,1) not in(0,1) then raise exception 'Invalid credit cost' using errcode='22023'; end if;
 if charge>coalesce((p_payload->>'maxCost')::integer,1) then raise exception 'Plan access changed' using errcode='P0002'; end if;
 if balance<charge then raise exception 'Trial credits exhausted' using errcode='P0001'; end if;
 insert into public.trial_report_context values(p_org,txid_current());
 -- Preserve canonical financial-role and branch checks, including on empty results.
 perform public.authorize_report_scope(p_org,start_day,end_day,branch,true);
 select coalesce(array_agg(id),'{}') into scope_ids from public.branches where organization_id=p_org and (branch is null or id=branch) and public.can_access_branch(p_org,id);
 if report_kind='clients' then
  result:=public.client_purchase_report_data(p_org,start_day,end_day,branch,coalesce(p_payload->>'client',''),coalesce(p_payload->>'item',''),coalesce(p_payload->>'purchaseKind','all'),1,true);
 elsif report_kind='hospitality' then
  result:=public.export_hospitality_workspace(p_org,branch,start_day,end_day,coalesce(p_payload->>'section','stays'));
 elsif industry_key='automotive' then
  result:=public.get_owner_report(p_org,start_day,end_day,branch);
  revenue:=public.get_invoice_revenue_breakdown(p_org,start_day,end_day,branch);
  result:=result||jsonb_build_object('services',revenue->'services','categories',revenue->'categories');
 else
  result:=public.get_appointment_report(p_org,start_day,end_day,branch);
 end if;
 if result is null or octet_length(result::text)>5242880 then raise exception 'Narrow the report scope' using errcode='54000'; end if;
 delete from public.trial_report_context where organization_id=p_org and transaction_id=txid_current();
 insert into public.trial_credit_operations(organization_id,request_id,actor_id,actor_role,feature,payload,cost,completed,result,branch_ids)
 values(p_org,p_request,auth.uid(),member_role,action_kind,p_payload,charge,true,result,scope_ids);
 update public.trial_credit_accounts set remaining=remaining-charge where organization_id=p_org;
 return public.read_credit_report(p_org,p_request);
end $$;
create function public.list_credit_reports(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',request_id,'kind',payload->>'kind','action',feature,'createdAt',created_at) order by created_at desc)
 from (select request_id,payload,feature,created_at from public.trial_credit_operations where organization_id=p_org and actor_id=auth.uid() and completed and feature in('advanced_report','csv_export') order by created_at desc limit 20) recent),'[]');
end $$;
revoke all on function public.read_credit_report(uuid,uuid),public.generate_credit_report(uuid,uuid,jsonb),public.list_credit_reports(uuid) from public,anon;
grant execute on function public.read_credit_report(uuid,uuid),public.generate_credit_report(uuid,uuid,jsonb),public.list_credit_reports(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
