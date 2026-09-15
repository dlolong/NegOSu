-- Shared appointment reporting for service businesses. Existing invoice reports stay intact.
create function public.get_appointment_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>731 then raise exception 'Invalid reporting range' using errcode='22023'; end if;
 if not public.has_permission(p_organization_id,'reports.view') or not public.has_entitlement(p_organization_id,'advanced_reports') then raise exception 'Reporting access required' using errcode='42501'; end if;
 if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.organization_id=p_organization_id and public.can_access_branch(p_organization_id,b.id)) then raise exception 'Branch not found' using errcode='42501'; end if;
 with branches as (
  select b.id,b.name,b.timezone from public.branches b where b.organization_id=p_organization_id and (p_branch_id is null or b.id=p_branch_id) and public.can_access_branch(p_organization_id,b.id)
 ), all_visits as (
  select a.*,(a.starts_at at time zone b.timezone)::date report_day from public.appointments a join branches b on b.id=a.branch_id where a.organization_id=p_organization_id
 ), visits as (
  select * from all_visits where report_day between p_start_date and p_end_date
 ), completed as (select * from visits where status='completed'),
 ledger as (
  select p.*,(p.paid_at at time zone b.timezone)::date report_day from public.payments p join branches b on b.id=p.branch_id where p.organization_id=p_organization_id and p.status='paid'
 ), receipts as (select * from ledger where report_day between p_start_date and p_end_date),
 balances as (
  select a.id,greatest(a.expected_total_centavos-coalesce(sum(p.amount_centavos),0),0) balance from visits a left join ledger p on p.appointment_id=a.id and p.branch_id=a.branch_id where a.status not in('cancelled','no_show') group by a.id,a.expected_total_centavos
 ), lifetime as (
  select customer_id,count(*) visits,min(report_day) first_day from all_visits where status='completed' group by customer_id
 ), services as (
  select item.service_name_snapshot service,coalesce(category.name,'Uncategorized') category,sum(item.unit_price_centavos)::bigint revenue,count(*) quantity
  from completed a join public.appointment_services item on item.appointment_id=a.id
  left join public.services s on s.id=item.service_id and s.organization_id=p_organization_id
  left join public.service_categories category on category.id=s.category_id and category.organization_id=p_organization_id
  group by item.service_name_snapshot,coalesce(category.name,'Uncategorized')
 )
 select jsonb_build_object(
  'startDate',p_start_date,'endDate',p_end_date,
  'summary',jsonb_build_object(
   'grossSalesCentavos',(select coalesce(sum(expected_total_centavos),0) from completed),
   'paymentsReceivedCentavos',(select coalesce(sum(amount_centavos),0) from receipts),
   'outstandingCentavos',(select coalesce(sum(balance),0) from balances),
   'jobsCompleted',(select count(*) from completed),
   'averageTicketCentavos',(select coalesce(round(avg(expected_total_centavos)),0) from completed),
   'customersServed',(select count(distinct customer_id) from completed),
   'repeatCustomers',(select count(*) from lifetime l where l.visits>1 and l.customer_id in(select customer_id from completed)),
   'newCustomers',(select count(*) from lifetime l where l.first_day between p_start_date and p_end_date and l.customer_id in(select customer_id from completed))
  ),
  'daily',(select coalesce(jsonb_agg(to_jsonb(x) order by x."day"),'[]') from (
   select report_day "day",sum(gross)::bigint "grossSalesCentavos",sum(received)::bigint "paymentsReceivedCentavos",sum(completed_count)::bigint "jobsCompleted" from (
    select report_day,expected_total_centavos gross,0::bigint received,1::bigint completed_count from completed
    union all select report_day,0,amount_centavos,0 from receipts
   ) amounts group by report_day
  ) x),
  'services',(select coalesce(jsonb_agg(jsonb_build_object('service',service,'category',category,'revenueCentavos',revenue,'quantity',quantity) order by revenue desc,service),'[]') from services),
  'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc,x.category),'[]') from (select category,sum(revenue)::bigint "revenueCentavos" from services group by category) x),
  'technicians',(select coalesce(jsonb_agg(to_jsonb(x) order by x."assignedJobs" desc,x.name),'[]') from (
   select staff.id,staff.full_name name,count(distinct a.id)::bigint "assignedJobs",count(distinct a.id) filter(where a.status='completed')::bigint "completedJobs"
   from visits a join public.appointment_staff_assignments assignment on assignment.appointment_id=a.id and assignment.organization_id=p_organization_id
   join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id and staff.organization_id=p_organization_id
   where a.status not in('cancelled','no_show') group by staff.id,staff.full_name
  ) x),
  'branches',(select coalesce(jsonb_agg(to_jsonb(x) order by x."grossSalesCentavos" desc,x.name),'[]') from (
   select b.id,b.name,coalesce(sum(a.expected_total_centavos),0)::bigint "grossSalesCentavos",count(a.id)::bigint invoices from branches b left join completed a on a.branch_id=b.id group by b.id,b.name
  ) x)
 ) into result;
 return result;
end $$;
revoke all on function public.get_appointment_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_appointment_report(uuid,date,date,uuid) to authenticated;
comment on function public.get_appointment_report(uuid,date,date,uuid) is 'Permission, plan and branch protected appointment analytics. Sales use completed service snapshots by appointment date; cash uses payment date. Legacy report keys map to neutral UI labels.';
