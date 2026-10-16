-- Authoritative dashboard amounts and uncapped operational counts.
begin;
create or replace function public.get_command_center_shared_metrics(
  p_organization_id uuid,
  p_branch_ids uuid[]
)
returns table(
  branch_id uuid,
  branch_name text,
  timezone text,
  revenue_today_centavos bigint,
  appointments_today bigint,
  outstanding_centavos bigint,
  low_stock_count bigint
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  requested_count integer:=coalesce(cardinality(p_branch_ids),0);
  eligible_count integer;
begin
  if auth.uid() is null
    or p_organization_id is null
    or not public.has_org_role(p_organization_id,array['owner','manager']::public.organization_role[])
    or requested_count not between 1 and 100
    or exists(select 1 from unnest(p_branch_ids) requested_id where requested_id is null)
    or requested_count<>(select count(distinct requested_id) from unnest(p_branch_ids) requested_id)
  then
    raise exception 'Command Center access denied' using errcode='42501';
  end if;

  select count(*) into eligible_count
  from public.branches branch
  where branch.id=any(p_branch_ids)
    and branch.organization_id=p_organization_id
    and branch.is_active
    and public.can_access_branch(p_organization_id,branch.id);

  if eligible_count<>requested_count then
    raise exception 'Command Center branch scope unavailable' using errcode='42501';
  end if;

  return query
  with eligible_branches as materialized (
    select branch.id,branch.name,branch.timezone
    from public.branches branch
    where branch.id=any(p_branch_ids)
      and branch.organization_id=p_organization_id
      and branch.is_active
      and public.can_access_branch(p_organization_id,branch.id)
  ),
  daily_revenue as (
    select branch.id,
      coalesce(sum(payment.amount_centavos) filter(where payment.id is not null),0)::bigint amount
    from eligible_branches branch
    left join public.payments payment on payment.branch_id=branch.id
      and payment.organization_id=p_organization_id
      and payment.status='paid'
      and payment.paid_at>=(date_trunc('day',current_timestamp at time zone branch.timezone) at time zone branch.timezone)
      and payment.paid_at<((date_trunc('day',current_timestamp at time zone branch.timezone)+interval '1 day') at time zone branch.timezone)
    group by branch.id
  ),
  daily_appointments as (
    select branch.id,
      count(appointment.id)::bigint amount
    from eligible_branches branch
    left join public.appointments appointment on appointment.branch_id=branch.id
      and appointment.organization_id=p_organization_id
      and appointment.starts_at>=(date_trunc('day',current_timestamp at time zone branch.timezone) at time zone branch.timezone)
      and appointment.starts_at<((date_trunc('day',current_timestamp at time zone branch.timezone)+interval '1 day') at time zone branch.timezone)
    group by branch.id
  ),
  invoice_outstanding as (
    select branch.id,
      coalesce(sum(invoice.balance_centavos) filter(where invoice.id is not null and invoice.status in('issued','partially_paid','paid')),0)::bigint amount
    from eligible_branches branch
    left join public.invoices invoice on invoice.branch_id=branch.id
      and invoice.organization_id=p_organization_id
      and invoice.status in('issued','partially_paid','paid')
      and invoice.balance_centavos>0
      and ((select industry from public.organizations where id=p_organization_id) not in('salon','pet_care') or exists(select 1 from public.checkout_invoices ci where ci.invoice_id=invoice.id))
    group by branch.id
  ),
  appointment_paid as (
    select payment.appointment_id,
      sum(payment.amount_centavos)::bigint amount
    from public.payments payment
    join eligible_branches branch on branch.id=payment.branch_id
    where payment.organization_id=p_organization_id
      and payment.appointment_id is not null
      and payment.status='paid'
    group by payment.appointment_id
  ),
  appointment_outstanding as (
    select branch.id,
      coalesce(sum(greatest(appointment.expected_total_centavos-coalesce(paid.amount,0),0)) filter(where appointment.id is not null),0)::bigint amount
    from eligible_branches branch
    left join public.appointments appointment on appointment.branch_id=branch.id
      and appointment.organization_id=p_organization_id
      and appointment.status='completed'
      and (select industry from public.organizations where id=p_organization_id) in('salon','pet_care')
    left join appointment_paid paid on paid.appointment_id=appointment.id
    group by branch.id
  ),
  low_stock as (
    select branch.id,
      count(stock.id) filter(where stock.low_stock)::bigint amount
    from eligible_branches branch
    left join public.inventory_stock stock on stock.branch_id=branch.id
      and stock.organization_id=p_organization_id
    group by branch.id
  )
  select branch.id,branch.name,branch.timezone,
    revenue.amount,
    appointments.amount,
    invoice_balance.amount+appointment_balance.amount,
    stock.amount
  from eligible_branches branch
  join daily_revenue revenue on revenue.id=branch.id
  join daily_appointments appointments on appointments.id=branch.id
  join invoice_outstanding invoice_balance on invoice_balance.id=branch.id
  join appointment_outstanding appointment_balance on appointment_balance.id=branch.id
  join low_stock stock on stock.id=branch.id
  order by branch.name,branch.id;
end
$$;

revoke all on function public.get_command_center_shared_metrics(uuid,uuid[]) from public,anon;
grant execute on function public.get_command_center_shared_metrics(uuid,uuid[]) to authenticated;

create function public.get_command_center_activity(p_organization_id uuid,p_branch_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 -- Reuse the canonical tenant/role/branch scope checks before reading operational data.
 perform * from public.get_command_center_shared_metrics(p_organization_id,p_branch_ids);
 with visits as materialized (
  select a.*, (a.starts_at at time zone b.timezone)::date=(now() at time zone b.timezone)::date today
  from public.appointments a join public.branches b on b.id=a.branch_id and b.organization_id=a.organization_id
  where a.organization_id=p_organization_id and a.branch_id=any(p_branch_ids)
 ), jobs as materialized (
  select j.* from public.job_orders j where j.organization_id=p_organization_id and j.branch_id=any(p_branch_ids)
 ) select jsonb_build_object(
  'checkedIn',(select count(*) from visits where status='checked_in'),
  'inService',(select count(*) from visits where status='in_service'),
  'completedToday',(select count(*) from visits where status='completed' and today),
  'readyPickup',(select count(*) from visits a join public.pet_appointment_details p on p.appointment_id=a.id and p.organization_id=a.organization_id where p.pickup_status='ready'),
  'jobsInProgress',(select count(*) from jobs where status='in_progress'),
  'awaitingApproval',(select count(*) from public.estimates e join jobs j on j.id=e.job_order_id and j.organization_id=e.organization_id and j.branch_id=e.branch_id where e.status='sent'),
  'readyRelease',(select count(*) from jobs where status in('ready','ready_for_release'))
 ) into result;
 return result;
end $$;
revoke all on function public.get_command_center_activity(uuid,uuid[]) from public,anon;
grant execute on function public.get_command_center_activity(uuid,uuid[]) to authenticated;
-- Public catalog contains only safe display fields; actual prices are unchanged.
-- The earlier public catalog may be absent in databases set up through SQL Editor.
drop function if exists public.public_plan_catalog();
create function public.public_plan_catalog() returns table(id text,name text,monthly_price_centavos bigint,yearly_price_centavos bigint,is_custom boolean,limits jsonb,features jsonb,monthly_credits integer,credit_grant_policy text)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.name,p.monthly_price_centavos::bigint,p.yearly_price_centavos::bigint,p.is_custom,p.limits,p.features,p.monthly_credits,p.credit_grant_policy from public.plans p where p.is_active order by p.sort_order,p.id
$$;
revoke all on function public.public_plan_catalog() from public;
grant execute on function public.public_plan_catalog() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
