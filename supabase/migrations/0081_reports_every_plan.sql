-- Reports are available on every plan. Existing RPC signatures and RLS stay intact.
update public.plans set features = features || '{"advanced_reports":true}'::jsonb
where id in ('starter','business','pro','multi_branch');
update public.plans set features = features || '{"advanced_reports":false}'::jsonb where id='free';

-- Internal guard shared by reporting RPCs. Free can read one accessible branch
-- within the last 30 local calendar days. Effective entitlements retain grace
-- periods and downgrade behavior; no plan value is accepted from the browser.
create function public.authorize_report_scope(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare advanced boolean; branch_today date;
begin
  if not public.has_permission(p_organization_id,'reports.view') then
    raise exception 'Reporting access required' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>731 then
    raise exception 'Invalid reporting range' using errcode='22023';
  end if;
  if p_branch_id is not null then
    select (now() at time zone b.timezone)::date into branch_today from public.branches b
    where b.id=p_branch_id and b.organization_id=p_organization_id and public.can_access_branch(p_organization_id,b.id);
    if not found then raise exception 'Branch not found' using errcode='42501'; end if;
  end if;
  advanced:=public.has_entitlement(p_organization_id,'advanced_reports');
  if not advanced and (p_branch_id is null or p_start_date<branch_today-29 or p_end_date>branch_today) then
    raise exception 'Free reports require one branch and dates within the last 30 days' using errcode='42501';
  end if;
  return advanced;
end $$;
revoke all on function public.authorize_report_scope(uuid,date,date,uuid) from public,anon,authenticated;

create or replace function public.get_owner_report(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_branch_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare result jsonb; advanced boolean;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 731 then
    raise exception 'Invalid reporting range';
  end if;
  advanced:=public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id);

  with eligible_branches as (
    select b.id,b.name,b.timezone from public.branches b
    where b.organization_id=p_organization_id and (p_branch_id is null or b.id=p_branch_id)
      and public.can_access_branch(p_organization_id,b.id)
  ), period_invoices as (
    select i.* from public.invoices i join eligible_branches b on b.id=i.branch_id
    where i.status<>'void' and i.issued_at is not null
      and (i.issued_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), period_payments as (
    select p.* from public.payments p join eligible_branches b on b.id=p.branch_id
    where p.status='paid' and p.paid_at is not null
      and (p.paid_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), period_jobs as (
    select j.* from public.job_orders j join eligible_branches b on b.id=j.branch_id
    where j.status='completed' and j.completed_at is not null
      and (j.completed_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), served as (
    select distinct customer_id from period_jobs
  ), customer_lifetime as (
    select j.customer_id,count(*) completed_jobs,min((j.completed_at at time zone b.timezone)::date) first_date
    from public.job_orders j join eligible_branches b on b.id=j.branch_id
    where j.status='completed' and j.completed_at is not null group by j.customer_id
  )
  select jsonb_build_object(
    'startDate',p_start_date,'endDate',p_end_date,
    'summary',jsonb_build_object(
      'grossSalesCentavos',(select coalesce(sum(total_centavos),0) from period_invoices),
      'paymentsReceivedCentavos',(select coalesce(sum(amount_centavos),0) from period_payments),
      'outstandingCentavos',(select coalesce(sum(balance_centavos),0) from period_invoices),
      'jobsCompleted',(select count(*) from period_jobs),
      'averageTicketCentavos',(select coalesce(round(avg(total_centavos)),0) from period_invoices),
      'customersServed',(select count(*) from served),
      'repeatCustomers',(select count(*) from customer_lifetime l join served s using(customer_id) where l.completed_jobs>1),
      'newCustomers',(select count(*) from customer_lifetime l join served s using(customer_id) where l.first_date between p_start_date and p_end_date)
    ),
    'daily',(select coalesce(jsonb_agg(to_jsonb(x) order by x."day"),'[]') from (
      select report_day "day",sum(gross)::bigint "grossSalesCentavos",sum(received)::bigint "paymentsReceivedCentavos",sum(jobs)::bigint "jobsCompleted"
      from (
        select (i.issued_at at time zone b.timezone)::date report_day,i.total_centavos gross,0::bigint received,0::bigint jobs from period_invoices i join eligible_branches b on b.id=i.branch_id
        union all select (p.paid_at at time zone b.timezone)::date,0,p.amount_centavos,0 from period_payments p join eligible_branches b on b.id=p.branch_id
        union all select (j.completed_at at time zone b.timezone)::date,0,0,1 from period_jobs j join eligible_branches b on b.id=j.branch_id
      ) d group by report_day
    ) x),
    'services',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc,x.service),'[]') from (
      select ji.service_name_snapshot service,coalesce(sc.name,'Uncategorized') category,sum(ji.line_total_centavos)::bigint "revenueCentavos",sum(ji.quantity)::bigint quantity
      from period_jobs j join public.job_order_items ji on ji.job_order_id=j.id left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id
      where ji.approval_status='approved' group by ji.service_name_snapshot,coalesce(sc.name,'Uncategorized')
    ) x),
    'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc),'[]') from (
      select coalesce(sc.name,'Uncategorized') category,sum(ji.line_total_centavos)::bigint "revenueCentavos"
      from period_jobs j join public.job_order_items ji on ji.job_order_id=j.id left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id
      where ji.approval_status='approved' group by coalesce(sc.name,'Uncategorized')
    ) x),
    'technicians',(select coalesce(jsonb_agg(to_jsonb(x) order by x."assignedJobs" desc,x.name),'[]') from (
      select coalesce(pr.full_name,u.email,'Unassigned') name,count(distinct j.id)::bigint "assignedJobs",count(distinct j.id) filter(where j.status='completed')::bigint "completedJobs"
      from public.job_orders j join eligible_branches b on b.id=j.branch_id left join auth.users u on u.id=j.primary_technician_user_id left join public.profiles pr on pr.id=u.id
      where (j.created_at at time zone b.timezone)::date between p_start_date and p_end_date group by coalesce(pr.full_name,u.email,'Unassigned')
    ) x),
    'branches',(select coalesce(jsonb_agg(to_jsonb(x) order by x."grossSalesCentavos" desc,x.name),'[]') from (
      select b.id,b.name,coalesce(sum(i.total_centavos),0)::bigint "grossSalesCentavos",count(i.id)::bigint invoices
      from eligible_branches b left join period_invoices i on i.branch_id=b.id group by b.id,b.name
    ) x)
  ) into result;
  if not advanced then
    return result || '{"services":[],"categories":[],"technicians":[],"branches":[]}'::jsonb;
  end if;
  return result;
end $$;

revoke all on function public.get_owner_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_owner_report(uuid,date,date,uuid) to authenticated;

create or replace function public.get_appointment_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; advanced boolean;
begin
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>731 then raise exception 'Invalid reporting range' using errcode='22023'; end if;
 advanced:=public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id);
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
 if not advanced then
  return result || '{"services":[],"categories":[],"technicians":[],"branches":[]}'::jsonb;
 end if;
 return result;
end $$;
revoke all on function public.get_appointment_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_appointment_report(uuid,date,date,uuid) to authenticated;
comment on function public.get_appointment_report(uuid,date,date,uuid) is 'Permission, plan and branch protected appointment analytics. Sales use completed service snapshots by appointment date; cash uses payment date. Legacy report keys map to neutral UI labels.';

create or replace function public.get_invoice_revenue_breakdown(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare result jsonb;begin
if not public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id) then
  raise exception 'Advanced reports require an eligible plan' using errcode='42501';
end if;
with lines as(select ii.description_snapshot service,coalesce(ii.category_name_snapshot,'Uncategorized')category,ii.quantity,ii.recognized_revenue_centavos from public.invoice_items ii join public.invoices i on i.id=ii.invoice_id join public.branches b on b.id=i.branch_id where i.organization_id=p_organization_id and i.status<>'void' and i.issued_at is not null and(i.issued_at at time zone b.timezone)::date between p_start_date and p_end_date and(p_branch_id is null or i.branch_id=p_branch_id)and public.can_access_branch(p_organization_id,i.branch_id))select jsonb_build_object('services',(select coalesce(jsonb_agg(to_jsonb(x)order by x."revenueCentavos" desc),'[]')from(select service,category,sum(recognized_revenue_centavos)::bigint "revenueCentavos",sum(quantity)::bigint quantity from lines group by service,category)x),'categories',(select coalesce(jsonb_agg(to_jsonb(x)order by x."revenueCentavos" desc),'[]')from(select category,sum(recognized_revenue_centavos)::bigint "revenueCentavos" from lines group by category)x))into result;return result;end$$;
revoke all on function public.get_invoice_revenue_breakdown(uuid,date,date,uuid)from public,anon;grant execute on function public.get_invoice_revenue_breakdown(uuid,date,date,uuid)to authenticated;
