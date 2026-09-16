-- Prepaid account plans paid through PayMongo. No changes to customer-service payments.
alter table public.plans add column if not exists is_custom boolean not null default false;
alter table public.plans add column if not exists provider_monthly_price_id text;
alter table public.plans add column if not exists provider_yearly_price_id text;
update public.plans set is_custom=true where id='multi_branch';
alter table public.organization_subscriptions add column if not exists billing_interval text check(billing_interval in('month','year'));
alter table public.organization_subscriptions add column if not exists paymongo_prepaid_value_centavos bigint check(paymongo_prepaid_value_centavos>=0);

create table public.billing_orders (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 created_by uuid not null references auth.users(id),
 request_id uuid not null,
 plan_id text not null references public.plans(id),plan_name text not null,
 billing_interval text not null check(billing_interval in('month','year')),
 amount_centavos bigint not null check(amount_centavos>0),currency text not null default 'PHP' check(currency='PHP'),
 livemode boolean not null,
 kind text not null check(kind in('new','renewal','upgrade')),
 status text not null default 'creating' check(status in('creating','pending','paid','cancelled','expired','review')),
 subscription_updated_at timestamptz,
 checkout_session_id text unique,checkout_url text,
 provider_payment_id text unique,
 last_checked_at timestamptz,checkout_closed_at timestamptz,paid_at timestamptz,access_starts_at timestamptz,access_ends_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,request_id)
);
create unique index billing_orders_one_open on public.billing_orders(organization_id) where status in('creating','pending');
create index billing_orders_history on public.billing_orders(organization_id,created_at desc);
alter table public.billing_orders enable row level security;
create policy billing_orders_owner_read on public.billing_orders for select to authenticated using(public.has_org_role(organization_id,array['owner']::public.organization_role[]));
revoke all on public.billing_orders from anon,authenticated;
grant select on public.billing_orders to authenticated;
grant all on public.billing_orders to service_role;

-- Prepaid access ends on the stored timestamp even if a scheduler is unavailable.
create or replace function public.effective_entitlements(p_organization_id uuid)returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('planId',p.id,'planName',p.name,'status',coalesce(s.status,'free'),'limits',p.limits,'features',p.features,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false),'graceEndsAt',s.grace_ends_at)
from public.plans p left join public.organization_subscriptions s on s.organization_id=p_organization_id
where p.id=case when (s.provider='paymongo' and s.status='active' and s.current_period_end>now()) or (s.provider is distinct from 'paymongo' and (s.status in('trialing','active')or(s.status='past_due' and s.grace_ends_at>now()))) then s.plan_id else 'free'end limit 1 $$;

-- Owner quote: all prices and existing value are resolved in the database.
create function public.quote_paymongo_plan(p_organization_id uuid,p_plan_id text,p_interval text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.plans; s public.organization_subscriptions; amount bigint; credit bigint:=0; active boolean; kind text:='new'; ends timestamptz; term interval;
begin
 if not public.has_org_role(p_organization_id,array['owner']::public.organization_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_interval not in('month','year') or p_interval is null or p_plan_id not in('starter','business','pro') then raise exception 'Invalid plan' using errcode='22023'; end if;
 select * into p from public.plans where id=p_plan_id and is_active and not is_custom;
 if p.id is null then raise exception 'Plan unavailable' using errcode='22023'; end if;
 amount:=case when p_interval='year' then p.yearly_price_centavos else p.monthly_price_centavos end;
 if amount is null or amount<=0 then raise exception 'Plan price unavailable' using errcode='22023'; end if;
 select * into s from public.organization_subscriptions where organization_id=p_organization_id;
 active:=(public.effective_entitlements(p_organization_id)->>'planId')<>'free';
 if active and s.provider is distinct from 'paymongo' then raise exception 'Manage the existing subscription before switching payment providers' using errcode='22023'; end if;
 term:=case when p_interval='year' then interval '1 year' else interval '1 month' end;
 ends:=now()+term;
 if active then
  if p.sort_order<(select sort_order from public.plans where id=s.plan_id) then raise exception 'Choose your current plan or a higher plan while access is active' using errcode='22023'; end if;
  if s.paymongo_prepaid_value_centavos is null or s.current_period_start is null or s.current_period_end<=s.current_period_start then raise exception 'Existing payment needs review' using errcode='22023'; end if;
  credit:=floor(s.paymongo_prepaid_value_centavos*least(1::numeric,greatest(0::numeric,extract(epoch from(s.current_period_end-now()))/extract(epoch from(s.current_period_end-s.current_period_start)))))::bigint;
  if s.plan_id=p_plan_id then kind:='renewal'; ends:=s.current_period_end+term;
  else kind:='upgrade'; ends:=ends+make_interval(secs=>(credit::numeric/amount*extract(epoch from(now()+term-now())))::double precision); end if;
 end if;
 return jsonb_build_object('planId',p.id,'planName',p.name,'interval',p_interval,'amountCentavos',amount,'currency','PHP','kind',kind,'creditCentavos',credit,'estimatedAccessEnd',ends,'subscriptionUpdatedAt',s.updated_at);
end $$;
revoke all on function public.quote_paymongo_plan(uuid,text,text) from public,anon;
grant execute on function public.quote_paymongo_plan(uuid,text,text) to authenticated;

create function public.begin_paymongo_order(p_organization_id uuid,p_plan_id text,p_interval text,p_request_id uuid,p_livemode boolean)
returns public.billing_orders language plpgsql security definer set search_path=public,pg_temp as $$
declare q jsonb; o public.billing_orders;
begin
 if not public.has_org_role(p_organization_id,array['owner']::public.organization_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_organization_id::text,0));
 select * into o from public.billing_orders where organization_id=p_organization_id and request_id=p_request_id;
 if o.id is not null then
  if o.plan_id is distinct from p_plan_id or o.billing_interval is distinct from p_interval or o.livemode is distinct from p_livemode then raise exception 'Checkout does not match the original request'; end if;
  return o;
 end if;
 select * into o from public.billing_orders where organization_id=p_organization_id and status in('creating','pending');
 if o.id is not null then
  if o.plan_id is distinct from p_plan_id or o.billing_interval is distinct from p_interval or o.livemode is distinct from p_livemode then raise exception 'Complete or cancel your open checkout first'; end if;
  return o;
 end if;
 q:=public.quote_paymongo_plan(p_organization_id,p_plan_id,p_interval);
 insert into public.billing_orders(organization_id,created_by,request_id,plan_id,plan_name,billing_interval,amount_centavos,livemode,kind,subscription_updated_at)
 values(p_organization_id,auth.uid(),p_request_id,p_plan_id,q->>'planName',p_interval,(q->>'amountCentavos')::bigint,p_livemode,q->>'kind',(q->>'subscriptionUpdatedAt')::timestamptz) returning * into o;
 return o;
end $$;
revoke all on function public.begin_paymongo_order(uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.begin_paymongo_order(uuid,text,text,uuid,boolean) to authenticated;

-- Only trusted server code may attach a provider session or finalize payment.
create function public.attach_paymongo_checkout(p_order_id uuid,p_session_id text,p_checkout_url text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.billing_orders;
begin
 select * into o from public.billing_orders where id=p_order_id for update;
 if o.id is null or p_session_id is null or p_checkout_url is null or p_session_id!~'^cs_[A-Za-z0-9]+$' or p_checkout_url!~'^https://checkout[.]paymongo[.]com/' then raise exception 'Invalid checkout'; end if;
 if o.checkout_session_id is not null and o.checkout_session_id<>p_session_id then raise exception 'Checkout already attached'; end if;
 update public.billing_orders set checkout_session_id=p_session_id,checkout_url=p_checkout_url,status=case when status='creating' then 'pending' else status end,updated_at=now() where id=o.id;
end $$;
revoke all on function public.attach_paymongo_checkout(uuid,text,text) from public,anon,authenticated;
grant execute on function public.attach_paymongo_checkout(uuid,text,text) to service_role;

create function public.finish_paymongo_order(p_order_id uuid,p_session_id text,p_payment_id text,p_amount bigint,p_currency text,p_livemode boolean,p_paid_at timestamptz,p_event_id text,p_payload_hash text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.billing_orders; s public.organization_subscriptions; credit bigint:=0; ends timestamptz; term interval; active boolean;
begin
 select * into o from public.billing_orders where id=p_order_id;
 if o.id is null then raise exception 'Order not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||o.organization_id::text,0));
 select * into o from public.billing_orders where id=p_order_id for update;
 if p_session_id is null or p_payment_id is null or p_event_id is null or p_payload_hash is null or p_session_id!~'^cs_[A-Za-z0-9]+$' or p_payment_id!~'^pay_[A-Za-z0-9]+$' or p_amount is distinct from o.amount_centavos or p_currency is distinct from o.currency or p_livemode is distinct from o.livemode
  or (o.checkout_session_id is not null and p_session_id<>o.checkout_session_id) or p_paid_at is null or p_paid_at<o.created_at-interval '5 minutes' or p_paid_at>now()+interval '5 minutes'
 then raise exception 'Payment verification mismatch'; end if;
 if o.status in('paid','review') then
  if o.provider_payment_id is distinct from p_payment_id then raise exception 'Duplicate payment needs review'; end if;
  return o.status;
 end if;
 select * into s from public.organization_subscriptions where organization_id=o.organization_id for update;
 -- Never overwrite a subscription changed since checkout or revive an abandoned order.
 if s.updated_at is distinct from o.subscription_updated_at or o.status not in('creating','pending') then
  update public.billing_orders set status='review',checkout_session_id=p_session_id,provider_payment_id=p_payment_id,paid_at=p_paid_at,updated_at=now() where id=o.id;
  insert into public.audit_events(organization_id,entity_type,entity_id,event_type,metadata) values(o.organization_id,'subscription',o.organization_id,'subscription.paymongo_review',jsonb_build_object('order_id',o.id));
  return 'review';
 end if;
 term:=case when o.billing_interval='year' then interval '1 year' else interval '1 month' end;
 ends:=now()+term;
 active:=s.provider='paymongo' and s.status='active' and s.current_period_end>now();
 if active then
  credit:=floor(s.paymongo_prepaid_value_centavos*least(1::numeric,greatest(0::numeric,extract(epoch from(s.current_period_end-now()))/nullif(extract(epoch from(s.current_period_end-s.current_period_start)),0))))::bigint;
  if s.plan_id=o.plan_id then ends:=s.current_period_end+term;
  else ends:=ends+make_interval(secs=>(credit::numeric/o.amount_centavos*extract(epoch from(now()+term-now())))::double precision); end if;
 end if;
 insert into public.organization_subscriptions(organization_id,plan_id,provider,status,billing_interval,current_period_start,current_period_end,cancel_at_period_end,paymongo_prepaid_value_centavos,grace_ends_at)
 values(o.organization_id,o.plan_id,'paymongo','active',o.billing_interval,now(),ends,true,o.amount_centavos+credit,null)
 on conflict(organization_id) do update set plan_id=excluded.plan_id,provider=excluded.provider,status=excluded.status,billing_interval=excluded.billing_interval,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=true,paymongo_prepaid_value_centavos=excluded.paymongo_prepaid_value_centavos,grace_ends_at=null,provider_customer_id=null,provider_subscription_id=null;
 update public.billing_orders set status='paid',checkout_session_id=p_session_id,provider_payment_id=p_payment_id,paid_at=p_paid_at,access_starts_at=now(),access_ends_at=ends,updated_at=now() where id=o.id;
 insert into public.billing_webhook_events(provider,provider_event_id,event_type,payload_hash,processed_at) values('paymongo',p_event_id,'checkout_session.payment.paid',p_payload_hash,now()) on conflict(provider,provider_event_id) do nothing;
 insert into public.audit_events(organization_id,entity_type,entity_id,event_type,metadata) values(o.organization_id,'subscription',o.organization_id,'subscription.paymongo_paid',jsonb_build_object('order_id',o.id,'plan',o.plan_id,'interval',o.billing_interval));
 return 'paid';
end $$;
revoke all on function public.finish_paymongo_order(uuid,text,text,bigint,text,boolean,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.finish_paymongo_order(uuid,text,text,bigint,text,boolean,timestamptz,text,text) to service_role;
notify pgrst,'reload schema';
