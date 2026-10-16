-- Extend canonical appointment analytics with salon visit and receipt tables.
-- Existing report scope, financial-role checks and credit-funded contexts apply.
begin;
alter function public.get_appointment_report(uuid,date,date,uuid) rename to appointment_report_summary_data;
revoke all on function public.appointment_report_summary_data(uuid,date,date,uuid) from public,anon,authenticated;
create function public.get_appointment_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; details jsonb;
begin
 -- Canonical reader authorizes before any details are read.
 result:=public.appointment_report_summary_data(p_organization_id,p_start_date,p_end_date,p_branch_id);
 if not exists(select 1 from public.organizations where id=p_organization_id and industry='salon') then return result; end if;
 with branches as materialized (
  select b.id,b.timezone from public.branches b where b.organization_id=p_organization_id
   and (p_branch_id is null or b.id=p_branch_id) and public.can_access_branch(p_organization_id,b.id)
 ), visits as materialized (
  select a.*,b.timezone from public.appointments a join branches b on b.id=a.branch_id
  where a.organization_id=p_organization_id
   and a.starts_at>=p_start_date::timestamp at time zone b.timezone
   and a.starts_at<(p_end_date+1)::timestamp at time zone b.timezone
 ), visit_rows as (
  select a.id,a.starts_at,a.timezone,a.status,coalesce(c.full_name,'Client unavailable') client,
   coalesce((select string_agg(distinct w.staff_name,', ' order by w.staff_name) from public.staff_work_participation w
    where w.organization_id=p_organization_id and w.branch_id=a.branch_id and w.kind='appointment' and w.target_id=a.id),'Unassigned') staff,
   coalesce((select string_agg(l.name||' × '||(case when l.included_key is not null then l.handed_over else l.quantity end)::text||case when l.included_key is not null then ' (included)' else '' end,', ' order by l.name,l.id)
    from public.checkouts ch join public.checkout_lines l on l.checkout_id=ch.id
    left join public.invoices i on i.id=l.invoice_id and i.organization_id=ch.organization_id and i.branch_id=ch.branch_id
    where ch.organization_id=p_organization_id and ch.branch_id=a.branch_id and ch.appointment_id=a.id and l.removed_at is null
     and (l.included_key is not null and l.handed_over>0 or l.included_key is null and i.status in('issued','partially_paid','paid'))),'—') products,
   a.expected_total_centavos+coalesce((select sum(i.total_centavos) from public.checkouts ch
    join public.checkout_invoices ci on ci.checkout_id=ch.id join public.invoices i on i.id=ci.invoice_id
    where ch.organization_id=p_organization_id and ch.branch_id=a.branch_id and ch.appointment_id=a.id
     and i.organization_id=p_organization_id and i.branch_id=a.branch_id and i.status in('issued','partially_paid','paid')),0) total
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
 return result||jsonb_build_object('salonDetails',details);
end $$;
revoke all on function public.get_appointment_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_appointment_report(uuid,date,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
