-- Platform reporting is available only to the trusted server, after its admin-ID check.
-- No tenant policy or tenant role is expanded by these read-only functions.
create function public.platform_admin_overview(p_livemode boolean default true)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
with days as (
  select generate_series((now() at time zone 'UTC')::date - 29,
    (now() at time zone 'UTC')::date, interval '1 day')::date as activity_date
), signups as (
  select (created_at at time zone 'UTC')::date as activity_date, count(*) as total from auth.users
  where created_at >= (((now() at time zone 'UTC')::date - 29)::timestamp at time zone 'UTC') group by 1
), receipts as (
  select (paid_at at time zone 'UTC')::date as activity_date, sum(amount_centavos) as total from billing_orders
  where status='paid' and livemode=p_livemode
    and paid_at >= (((now() at time zone 'UTC')::date - 29)::timestamp at time zone 'UTC') group by 1
)
select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'businesses', (select count(*) from organizations),
  'activeBusinesses', (select count(*) from organizations where status='active'),
  'unverifiedUsers', (select count(*) from auth.users where email_confirmed_at is null),
  'pastDue', (select count(*) from organization_subscriptions where status='past_due'),
  'reviewOrders', (select count(*) from billing_orders where status='review' and livemode=p_livemode),
  'webhookErrors', (select count(*) from billing_webhook_events where processing_error is not null),
  'collected', (select coalesce(sum(total),0) from receipts where activity_date <= (now() at time zone 'UTC')::date),
  'signups', (select jsonb_agg(jsonb_build_object('label',to_char(d.activity_date,'Mon DD'),'value',coalesce(s.total,0)) order by d.activity_date) from days d left join signups s using(activity_date)),
  'payments', (select jsonb_agg(jsonb_build_object('label',to_char(d.activity_date,'Mon DD'),'value',coalesce(r.total,0)) order by d.activity_date) from days d left join receipts r using(activity_date)),
  'plans', (select coalesce(jsonb_agg(jsonb_build_object('label',plan_id,'value',total) order by plan_id),'[]'::jsonb) from (select plan_id,count(*) total from organization_subscriptions group by plan_id) p)
) $$;

create function public.platform_admin_signups(p_page integer default 1, p_search text default '')
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_page is null or p_page < 1 or p_page > 999999 or p_search is null or length(p_search)>120 then
    raise exception 'Invalid directory filter' using errcode='22023';
  end if;
  with filtered as (
    select u.id,u.email,p.full_name,u.created_at,u.email_confirmed_at,u.last_sign_in_at
    from auth.users u left join profiles p on p.id=u.id
    where p_search='' or strpos(lower(coalesce(u.email,'')),lower(p_search))>0
      or strpos(lower(coalesce(p.full_name,'')),lower(p_search))>0
  ), page as (select * from filtered order by created_at desc,id limit 25 offset (p_page-1)*25)
  select jsonb_build_object('total',(select count(*) from filtered),
    'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from page p),'[]'::jsonb)) into result;
  return result;
end $$;

revoke all on function public.platform_admin_overview(boolean),public.platform_admin_signups(integer,text) from public,anon,authenticated;
grant execute on function public.platform_admin_overview(boolean),public.platform_admin_signups(integer,text) to service_role;
