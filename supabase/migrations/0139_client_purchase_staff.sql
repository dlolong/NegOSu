-- Add operational staff attribution without joining staff into financial totals.
-- Existing reporting entitlements, tenant/branch checks and RLS are preserved.
begin;
create or replace function public.get_client_purchase_report(
 p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,
 p_client_search text default '',p_item_search text default '',p_kind text default 'all',p_page integer default 1
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
  select * from clients order by lower(client_name),client_key limit 50 offset (p_page-1)*50
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
revoke all on function public.get_client_purchase_report(uuid,date,date,uuid,text,text,text,integer) from public,anon;
grant execute on function public.get_client_purchase_report(uuid,date,date,uuid,text,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
