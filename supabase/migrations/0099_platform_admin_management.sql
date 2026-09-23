-- Trusted platform mutations. The application verifies the platform-admin allowlist
-- before invoking this service-role-only function. No tenant grants are expanded.
create table public.platform_admin_audit (
 request_id uuid primary key,
 actor_id uuid not null,
 action text not null,
 target_id text not null,
 reason text not null,
 request_payload jsonb not null,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz not null default now()
);
alter table public.platform_admin_audit enable row level security;
revoke all on public.platform_admin_audit from public,anon,authenticated;
grant select,insert on public.platform_admin_audit to service_role;

alter table public.plans add column admin_revision bigint not null default 0;
create function public.bump_plan_admin_revision() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.admin_revision:=old.admin_revision+1; return new; end $$;
create trigger plans_admin_revision before update on public.plans for each row execute function public.bump_plan_admin_revision();

create function public.platform_admin_mutate(
 p_actor uuid,p_request uuid,p_action text,p_target text,p_expected text,
 p_values jsonb,p_reason text,p_confirmation text default ''
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
 prior public.platform_admin_audit; payload jsonb; before_row jsonb; after_row jsonb;
 plan public.plans; sub public.organization_subscriptions; org uuid;
 amount bigint; annual bigint; expires timestamptz; new_status text; new_plan text;
begin
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor)
   or p_request is null or p_target is null or length(p_target)>120
   or p_action is null or p_action not in('delete_user','delete_business','update_subscription','update_plan')
   or p_reason is null or length(trim(p_reason))<5 or length(p_reason)>500
   or p_values is null or jsonb_typeof(p_values)<>'object' then
   raise exception 'Invalid admin request' using errcode='22023';
 end if;
 payload:=jsonb_build_object('expected',p_expected,'values',p_values,'confirmation',p_confirmation);
 perform pg_advisory_xact_lock(hashtextextended('platform-request:'||p_request::text,0));
 select * into prior from platform_admin_audit where request_id=p_request;
 if found then
  if prior.actor_id<>p_actor or prior.action<>p_action or prior.target_id<>p_target
    or prior.reason<>trim(p_reason) or prior.request_payload<>payload then
    raise exception 'Admin request conflict' using errcode='22023';
  end if;
  return;
 end if;
 if p_action in('delete_user','delete_business') and p_confirmation is distinct from 'DELETE '||p_target then
   raise exception 'Deletion confirmation does not match' using errcode='22023';
 end if;
 if p_action='update_plan' then
  select * into plan from plans where id=p_target for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if p_expected is distinct from plan.admin_revision::text then raise exception 'Record changed; reload and try again' using errcode='40001'; end if;
  if coalesce(length(trim(p_values->>'name')),0) not between 2 and 80
    or coalesce(p_values->>'monthly','') !~ '^[0-9]{1,10}$'
    or (p_values->>'yearly' is not null and (p_values->>'yearly') !~ '^[0-9]{1,10}$') then
    raise exception 'Invalid plan details' using errcode='22023';
  end if;
  amount:=(p_values->>'monthly')::bigint; annual:=(p_values->>'yearly')::bigint;
  if amount>1000000000 or annual>1000000000 or (plan.id='free' and (amount<>0 or annual is distinct from 0::bigint))
    or (plan.id<>'free' and not plan.is_custom and (amount=0 or annual=0)) then
    raise exception 'Invalid plan price' using errcode='22023';
  end if;
  if (plan.provider_monthly_price_id is not null or plan.provider_yearly_price_id is not null)
    and (amount<>plan.monthly_price_centavos or annual is distinct from plan.yearly_price_centavos) then
    raise exception 'Stripe-linked prices must be changed through Stripe' using errcode='22023';
  end if;
  before_row:=jsonb_build_object('name',plan.name,'monthly',plan.monthly_price_centavos,'yearly',plan.yearly_price_centavos);
  update plans set name=trim(p_values->>'name'),monthly_price_centavos=amount,yearly_price_centavos=annual where id=p_target;
  after_row:=jsonb_build_object('name',trim(p_values->>'name'),'monthly',amount,'yearly',annual);
 elsif p_action='update_subscription' then
  org:=p_target::uuid;
  perform pg_advisory_xact_lock(hashtextextended('billing:'||org::text,0));
  perform 1 from organizations where id=org for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  select * into sub from organization_subscriptions where organization_id=org for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if p_expected is null or sub.updated_at is distinct from p_expected::timestamptz then raise exception 'Record changed; reload and try again' using errcode='40001'; end if;
  if sub.provider='stripe' then raise exception 'Manage Stripe subscriptions through Stripe' using errcode='22023'; end if;
  if exists(select 1 from billing_orders where organization_id=org and status in('creating','pending','review')) then
    raise exception 'Resolve open or review payments first' using errcode='22023';
  end if;
  new_status:=p_values->>'status'; new_plan:=p_values->>'planId'; expires:=nullif(p_values->>'expiresAt','')::timestamptz;
  if new_status is null or new_status not in('free','active','paused','cancelled')
    or not exists(select 1 from plans where id=new_plan and is_active)
    or (new_status='free' and new_plan<>'free') or (new_status='active' and (new_plan='free' or expires is null or not isfinite(expires) or expires<=now())) then
    raise exception 'Invalid subscription details' using errcode='22023';
  end if;
  before_row:=jsonb_build_object('planId',sub.plan_id,'status',sub.status,'expiresAt',sub.current_period_end);
  update organization_subscriptions set plan_id=new_plan,status=new_status,
    provider=coalesce(provider,'manual'),current_period_start=case when new_status='active' then least(coalesce(current_period_start,now()),now()) else current_period_start end,
    current_period_end=case when new_status='active' then expires else current_period_end end,
    grace_ends_at=null,cancel_at_period_end=true,updated_at=clock_timestamp()
    where organization_id=org;
  after_row:=jsonb_build_object('planId',new_plan,'status',new_status,'expiresAt',case when new_status='active' then expires else sub.current_period_end end);
 elsif p_action='delete_user' then
  if p_target::uuid=p_actor then raise exception 'You cannot delete your own account' using errcode='22023'; end if;
  -- Serialize membership edits so a concurrent owner demotion cannot orphan a business.
  lock table organization_memberships in share row exclusive mode;
  perform 1 from auth.users where id=p_target::uuid for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if exists(select 1 from organization_memberships m where m.user_id=p_target::uuid and m.role='owner' and m.is_active
    and not exists(select 1 from organization_memberships other where other.organization_id=m.organization_id and other.user_id<>m.user_id and other.role='owner' and other.is_active)) then
    raise exception 'Transfer business ownership before deleting this user' using errcode='22023';
  end if;
  before_row:=jsonb_build_object('id',p_target);
  -- Existing NO ACTION/RESTRICT references deliberately protect operational history.
  delete from auth.users where id=p_target::uuid;
 elsif p_action='delete_business' then
  org:=p_target::uuid;
  perform pg_advisory_xact_lock(hashtextextended('billing:'||org::text,0));
  perform 1 from organizations where id=org for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if exists(select 1 from billing_orders where organization_id=org)
    or exists(select 1 from payments where organization_id=org)
    or exists(select 1 from invoices where organization_id=org)
    or exists(select 1 from hospitality_stays where organization_id=org)
    or exists(select 1 from organization_subscriptions where organization_id=org and (provider_subscription_id is not null or status in('active','trialing','past_due'))) then
    raise exception 'Business has retained billing or stay records' using errcode='22023';
  end if;
  before_row:=jsonb_build_object('id',p_target);
  delete from organizations where id=org;
 end if;
 insert into platform_admin_audit(request_id,actor_id,action,target_id,reason,request_payload,before_state,after_state)
 values(p_request,p_actor,p_action,p_target,trim(p_reason),payload,before_row,after_row);
end $$;
revoke all on function public.platform_admin_mutate(uuid,uuid,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.platform_admin_mutate(uuid,uuid,text,text,text,jsonb,text,text) to service_role;

-- Manually granted access expires without relying on a scheduled job.
create or replace function public.effective_entitlements(p_organization_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('planId',p.id,'planName',p.name,'status',coalesce(s.status,'free'),'limits',p.limits,'features',p.features,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false),'graceEndsAt',s.grace_ends_at)
from public.plans p left join public.organization_subscriptions s on s.organization_id=p_organization_id
where p.id=case when (s.provider in('paymongo','manual') and s.status='active' and s.current_period_end>now()) or (s.provider is distinct from 'paymongo' and s.provider is distinct from 'manual' and (s.status in('trialing','active')or(s.status='past_due' and s.grace_ends_at>now()))) then s.plan_id else 'free'end limit 1 $$;
notify pgrst,'reload schema';

-- Public marketing receives only the active catalog's public presentation fields.
create function public.public_plan_catalog() returns table(
 id text,name text,monthly_price_centavos bigint,yearly_price_centavos bigint,is_custom boolean
) language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.name,p.monthly_price_centavos,p.yearly_price_centavos,p.is_custom
 from plans p where p.is_active order by p.sort_order,p.id
$$;
revoke all on function public.public_plan_catalog() from public;
grant execute on function public.public_plan_catalog() to anon,authenticated,service_role;
