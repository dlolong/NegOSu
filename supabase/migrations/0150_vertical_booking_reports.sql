-- Shared appointment details for salon, pet care and automotive reports.
-- Canonical summary readers retain scope, plan, branch and financial checks.
begin;
create function public.booking_report_details_data(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare details jsonb; industry_key text;
begin
 perform public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id,true);
 select industry into industry_key from public.organizations where id=p_organization_id;
 with branches as materialized (
  select b.id,b.timezone from public.branches b where b.organization_id=p_organization_id
   and (p_branch_id is null or b.id=p_branch_id) and public.can_access_branch(p_organization_id,b.id)
 ), visits as materialized (
  select a.*,b.timezone from public.appointments a join branches b on b.id=a.branch_id
  where a.organization_id=p_organization_id
   and a.starts_at>=p_start_date::timestamp at time zone b.timezone
   and a.starts_at<(p_end_date+1)::timestamp at time zone b.timezone
 ), visit_jobs as materialized (
  select j.id,j.appointment_id,j.branch_id from public.job_orders j join visits a on a.id=j.appointment_id and a.branch_id=j.branch_id where j.organization_id=p_organization_id
 ), visit_checkouts as materialized (
  select distinct a.id appointment_id,ch.id checkout_id from visits a join public.checkouts ch on ch.organization_id=p_organization_id and ch.branch_id=a.branch_id
  left join public.invoices source on source.id=ch.source_invoice_id and source.organization_id=p_organization_id and source.branch_id=a.branch_id
  where ch.appointment_id=a.id or exists(select 1 from visit_jobs j where j.appointment_id=a.id and j.id=source.job_order_id)
 ), visit_rows as (
  select a.id,a.starts_at,a.timezone,a.status,coalesce(c.full_name,'Client unavailable') client,
   coalesce((select string_agg(distinct w.staff_name,', ' order by w.staff_name) from public.staff_work_participation w
    where w.organization_id=p_organization_id and w.branch_id=a.branch_id and (w.kind='appointment' and w.target_id=a.id or w.kind='job' and exists(select 1 from visit_jobs j where j.appointment_id=a.id and j.id=w.target_id))),'Unassigned') staff,
   coalesce((select string_agg(l.name||' × '||(case when l.included_key is not null then l.handed_over else l.quantity end)::text||case when l.included_key is not null then ' (included)' else '' end,', ' order by l.name,l.id)
    from public.checkouts ch join public.checkout_lines l on l.checkout_id=ch.id
    left join public.invoices i on i.id=l.invoice_id and i.organization_id=ch.organization_id and i.branch_id=ch.branch_id
    where ch.organization_id=p_organization_id and ch.branch_id=a.branch_id and exists(select 1 from visit_checkouts vc where vc.appointment_id=a.id and vc.checkout_id=ch.id) and l.removed_at is null
     and (l.included_key is not null and l.handed_over>0 or l.included_key is null and i.status in('issued','partially_paid','paid'))),'—') products,
   case when industry_key='automotive' then coalesce((select sum(i.total_centavos) from public.invoices i
    where i.organization_id=p_organization_id and i.branch_id=a.branch_id and i.status in('issued','partially_paid','paid')
     and (exists(select 1 from visit_jobs j where j.appointment_id=a.id and j.id=i.job_order_id)
      or exists(select 1 from visit_checkouts vc join public.checkout_invoices ci on ci.checkout_id=vc.checkout_id where vc.appointment_id=a.id and ci.invoice_id=i.id))),0)
   else a.expected_total_centavos+coalesce((select sum(i.total_centavos) from visit_checkouts vc
    join public.checkout_invoices ci on ci.checkout_id=vc.checkout_id join public.invoices i on i.id=ci.invoice_id
    where vc.appointment_id=a.id and i.organization_id=p_organization_id and i.branch_id=a.branch_id and i.status in('issued','partially_paid','paid')),0) end total
  from visits a left join public.customers c on c.id=a.customer_id and c.organization_id=p_organization_id
 ), receipt_rows as (
  select p.id,p.paid_at,b.timezone,p.method,p.status,p.amount_centavos amount
  from public.payments p join branches b on b.id=p.branch_id
  where p.organization_id=p_organization_id
   and p.paid_at>=p_start_date::timestamp at time zone b.timezone
   and p.paid_at<(p_end_date+1)::timestamp at time zone b.timezone
 )
 select jsonb_build_object(
  'appointments',coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at desc,v.id) from visit_rows v),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc,p.id) from receipt_rows p),'[]'::jsonb)
 ) into details;
 return details||jsonb_build_object('industry',industry_key);
end $$;
revoke all on function public.booking_report_details_data(uuid,date,date,uuid) from public,anon,authenticated;

create or replace function public.get_appointment_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; details jsonb; industry_key text;
begin
 result:=public.appointment_report_summary_data(p_organization_id,p_start_date,p_end_date,p_branch_id);
 select industry into industry_key from public.organizations where id=p_organization_id;
 if industry_key not in('salon','pet_care') then return result; end if;
 details:=public.booking_report_details_data(p_organization_id,p_start_date,p_end_date,p_branch_id);
 -- Preserve the salon response key for previously deployed readers.
 return result||jsonb_build_object('bookingDetails',details)||case when industry_key='salon' then jsonb_build_object('salonDetails',details) else '{}'::jsonb end;
end $$;

alter function public.get_owner_report(uuid,date,date,uuid) rename to owner_report_summary_data;
revoke all on function public.owner_report_summary_data(uuid,date,date,uuid) from public,anon,authenticated;
create function public.get_owner_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.owner_report_summary_data(p_organization_id,p_start_date,p_end_date,p_branch_id);
 if exists(select 1 from public.organizations where id=p_organization_id and industry='automotive') then
  result:=result||jsonb_build_object('bookingDetails',public.booking_report_details_data(p_organization_id,p_start_date,p_end_date,p_branch_id));
 end if;
 return result;
end $$;
revoke all on function public.get_owner_report(uuid,date,date,uuid),public.get_appointment_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_owner_report(uuid,date,date,uuid),public.get_appointment_report(uuid,date,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
