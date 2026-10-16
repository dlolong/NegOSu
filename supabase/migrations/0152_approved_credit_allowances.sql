-- Approved launch allowances. Reuses the existing ledger; no production backfill.
begin;
alter table public.plans add column one_time_credits integer not null default 0 check(one_time_credits>=0);
update public.plans set monthly_credits=case id when 'starter' then 100 when 'business' then 300 when 'pro' then 750 else 0 end,
 credit_grant_policy=case when id in('starter','business','pro') then 'subscription_month' else null end,
 one_time_credits=case when id='free' then 100 else 0 end where id in('free','starter','business','pro');
update public.plans set name='Growth' where id='business';
insert into public.credit_operation_registry(operation_key,label,entitlement,credit_cost,enabled,billable_event) values
 ('sms_notification','SMS segment','reminders',1,true,'provider_accepted'),
 ('transactional_email','Transactional email',null,0,true,'provider_accepted'),
 ('advanced_report','Advanced report','advanced_reports',0,true,'operation_committed'),
 ('csv_export','Report export','advanced_reports',0,true,'operation_committed'),
 ('image_upload','Image upload','image_uploads',0,true,'operation_committed'),
 ('ai_insight','AI insight',null,5,false,'operation_committed'),
 ('ai_advanced_operation','Advanced AI operation',null,null,false,'operation_committed')
on conflict(operation_key) do update set label=excluded.label,entitlement=excluded.entitlement,credit_cost=excluded.credit_cost,enabled=excluded.enabled;
-- Purchased credits are not sold yet. New purchased lots require a fixed 12-month expiry.
alter table public.organization_credit_grants drop constraint organization_credit_grants_check1;
alter table public.organization_credit_grants add constraint purchased_credit_expiry check(credit_class<>'purchased' or expires_at=created_at+interval '12 months') not valid;
alter table public.organization_credit_grants add column subscription_key text;
-- Anchor monthly anniversaries to the original billing timestamp (including Jan 31).
create function public.credit_period_window(p_start timestamptz,p_end timestamptz,p_now timestamptz)
returns table(period_start timestamptz,period_end timestamptz) language plpgsql stable set timezone='UTC' as $$
declare months integer;
begin
 if p_start is null or p_end is null or p_now<p_start or p_now>=p_end then return; end if;
 months:=((extract(year from p_now)-extract(year from p_start))*12+extract(month from p_now)-extract(month from p_start))::integer;
 if p_start+make_interval(months=>months)>p_now then months:=months-1; end if;
 return query select p_start+make_interval(months=>months),least(p_start+make_interval(months=>months+1),p_end);
end $$;
revoke all on function public.credit_period_window(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function public.ensure_credit_period(p_org uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare opening integer; g public.organization_credit_grants; ent jsonb; configured integer; policy text; sub public.organization_subscriptions;
 period_begin timestamptz; period_finish timestamptz; expired bigint; granted integer; subscription_identity text;
begin
 -- Reuse the previous account row as the business-wide mutex and exact opening balance.
 insert into public.trial_credit_accounts(organization_id) values(p_org) on conflict do nothing;
 select remaining into opening from public.trial_credit_accounts where organization_id=p_org for update;
 insert into public.organization_credit_grants(organization_id,credit_class,grant_key,allowance)
 values(p_org,'one_time','approved-one-time',(select one_time_credits from public.plans where id='free')) on conflict do nothing returning * into g;
 if found and opening>0 then
  insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
  values(p_org,g.id,'GRANT',opening,'existing_one_time_balance','opening-one-time');
 end if;
 ent:=public.effective_entitlements(p_org);
 select monthly_credits,credit_grant_policy into configured,policy from public.plans where id=ent->>'planId';
 if configured is not null and policy='subscription_month' then
   select * into sub from public.organization_subscriptions where organization_id=p_org and plan_id=ent->>'planId';
   if sub.current_period_start is not null and sub.current_period_end>now() and sub.current_period_start<=now() then
    select w.period_start,w.period_end into period_begin,period_finish from public.credit_period_window(sub.current_period_start,sub.current_period_end,now()) w;
   end if;
  subscription_identity:=coalesce(sub.provider,'manual')||':'||coalesce(sub.provider_subscription_id,p_org::text);
  -- Retain an already-started allowance window across provider anchor changes.
  select * into g from public.organization_credit_grants where organization_id=p_org and credit_class='plan'
   and period_start<=now() and period_end>now() order by period_start limit 1;
  if found then period_begin:=g.period_start; period_finish:=g.period_end; end if;
  if configured>0 and period_begin is not null and period_finish>now() then
   select coalesce(sum(allowance),0) into granted from public.organization_credit_grants
    where organization_id=p_org and credit_class='plan' and period_start=period_begin and period_end=period_finish;
   if configured>granted then
    insert into public.organization_credit_grants(organization_id,credit_class,grant_key,allowance,period_start,period_end,expires_at,subscription_key)
    values(p_org,'plan','included:'||subscription_identity||':'||extract(epoch from period_begin)::text||':'||configured,
     configured-granted,period_begin,period_finish,period_finish,subscription_identity) on conflict do nothing returning * into g;
    if found then insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
     values(p_org,g.id,'GRANT',g.allowance,'configured_period_allowance','grant:'||g.id); end if;
   end if;
  end if;
 end if;
 -- Expire only unused plan credits. Reserved allocations remain held until resolved.
 for g in select * from public.organization_credit_grants where organization_id=p_org and credit_class in('plan','purchased') and expires_at<=now() loop
  expired:=public.credit_lot_balance(g.id)-public.credit_lot_held(g.id);
  if expired>0 then insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
   values(p_org,g.id,'EXPIRATION',-expired,'period_ended','expire:'||g.id||':'||public.credit_lot_balance(g.id)); end if;
 end loop;
end $$;
create or replace function public.plan_entitlements(p_organization_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('planId',p.id,'planName',p.name,'status',coalesce(s.status,'free'),'limits',p.limits,'features',p.features,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false),'graceEndsAt',s.grace_ends_at)
from public.plans p left join public.organization_subscriptions s on s.organization_id=p_organization_id
where p.id=case when (s.provider in('paymongo','manual') and s.status='active' and s.current_period_end>now()) or (s.provider is distinct from 'paymongo' and s.provider is distinct from 'manual' and ((s.status in('trialing','active') and s.current_period_end>now())or(s.status='past_due' and s.grace_ends_at>now()))) then s.plan_id else 'free'end limit 1 $$;
create or replace function public.effective_entitlements(p_organization_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select public.plan_entitlements(p_organization_id)||jsonb_build_object('monthlyCredits',p.monthly_credits,'oneTimeCredits',p.one_time_credits)
 from public.plans p where p.id=public.plan_entitlements(p_organization_id)->>'planId'
$$;
create or replace function public.has_entitlement(p_organization_id uuid,p_feature text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((public.effective_entitlements(p_organization_id)->'features'->>p_feature)::boolean,false)
$$;
create or replace function public.credit_balance_data(p_org uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with lots as (
  select g.*,public.credit_lot_balance(g.id) balance,public.credit_lot_held(g.id) held from public.organization_credit_grants g where organization_id=p_org and (expires_at is null or expires_at>now())
 ), totals as (
  select coalesce(sum(balance-held),0)::bigint remaining,(case when count(*) filter(where credit_class='plan')>0 then coalesce(sum(allowance) filter(where credit_class='plan'),0)+coalesce(sum(greatest(balance-held,0)) filter(where credit_class<>'plan'),0) else coalesce(sum(allowance),0) end)::bigint allowance,
   (select coalesce(sum(public.credit_lot_held(id)),0) from public.organization_credit_grants where organization_id=p_org)::bigint held,
   coalesce(sum(balance-held) filter(where credit_class='one_time'),0)::bigint one_time,coalesce(sum(balance-held) filter(where credit_class='plan'),0)::bigint included,
   coalesce(sum(allowance) filter(where credit_class='plan'),0)::bigint included_allowance,coalesce(sum(greatest(allowance-balance,0)) filter(where credit_class='plan'),0)::bigint included_used,coalesce(sum(balance-held) filter(where credit_class='purchased'),0)::bigint purchased,coalesce(sum(allowance) filter(where credit_class='one_time'),0)::bigint one_time_allowance,max(period_start) period_start,max(period_end) period_end
  from lots
 ) select jsonb_build_object('remaining',remaining,'allowance',allowance,'reserved',held,'oneTimeRemaining',one_time,'monthlyRemaining',included,'monthlyAllowance',included_allowance,
  'purchasedRemaining',purchased,'oneTimeAllowance',one_time_allowance,'usedThisPeriod',included_used,'periodEnd',period_end,'periodStart',period_start,'nextRefresh',case when public.effective_entitlements(p_org)->>'planId'<>'free' then period_end else null end,'periodKey',coalesce('plan:'||extract(epoch from period_start)::text,'one-time'),
  'status',public.credit_status(remaining,allowance)) from totals
$$;
create or replace function public.reserve_credit_operation(p_org uuid,p_operation text,p_source uuid,p_request text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare config public.credit_operation_registry; r public.organization_credit_reservations; hash text; balance jsonb; g public.organization_credit_grants; available bigint; needed integer; take integer;
begin
 if p_org is null or p_source is null or p_request is null or length(p_request) not between 1 and 200 or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid credit operation' using errcode='22023'; end if;
 select * into config from public.credit_operation_registry where operation_key=p_operation;
 if config.entitlement is not null and not public.has_entitlement(p_org,config.entitlement) then
  insert into public.audit_events(organization_id,entity_type,entity_id,event_type,metadata) values(p_org,'credit_operation',p_source,'feature.denied',jsonb_build_object('feature',config.entitlement));
  return jsonb_build_object('code','FEATURE_NOT_ENTITLED');
 end if;
 perform public.ensure_credit_period(p_org);
 hash:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 select * into r from public.organization_credit_reservations where organization_id=p_org and operation_key=config.operation_key and idempotency_key=p_request;
 if found then
  if r.source_id<>p_source or r.payload_hash<>hash then return jsonb_build_object('code','IDEMPOTENCY_CONFLICT'); end if;
  if r.status='committed' then return jsonb_build_object('code','CREDIT_COMMITTED'); end if;
  if r.status='reserved' then return jsonb_build_object('code','CREDIT_RESERVED'); end if;
 end if;
 if config.credit_cost is null or not config.enabled or config.credit_cost=0 then return jsonb_build_object('code','CREDIT_NOT_REQUIRED'); end if;
 balance:=public.credit_balance_data(p_org);
 needed:=coalesce(r.cost,config.credit_cost * case when p_operation='sms_notification' then (p_payload->>'segments')::integer else 1 end);
 if needed is null or needed<=0 or needed>1000000 then raise exception 'Invalid metered units' using errcode='22023'; end if;
 if (balance->>'remaining')::bigint<needed then perform public.notify_credit_threshold(p_org); return jsonb_build_object('code','INSUFFICIENT_CREDITS','required',needed,'remaining',balance->'remaining'); end if;
 if r.id is null then
  insert into public.organization_credit_reservations(organization_id,operation_key,source_id,idempotency_key,payload_hash,cost,status)
  values(p_org,config.operation_key,p_source,p_request,hash,needed,'reserved') returning * into r;
 else
  delete from public.organization_credit_allocations where reservation_id=r.id;
  update public.organization_credit_reservations set status='reserved',updated_at=now() where id=r.id;
 end if;
 for g in select * from public.organization_credit_grants where organization_id=p_org and (expires_at is null or expires_at>now()) order by case credit_class when 'plan' then 0 when 'one_time' then 1 else 2 end,expires_at nulls last,created_at,id loop
  available:=public.credit_lot_balance(g.id)-public.credit_lot_held(g.id); take:=least(needed,available);
  if take>0 then insert into public.organization_credit_allocations values(p_org,r.id,g.id,take); needed:=needed-take; end if;
  exit when needed=0;
 end loop;
 if needed<>0 then raise exception 'Credit allocation mismatch' using errcode='23514'; end if;
 perform public.notify_credit_threshold(p_org);
 return jsonb_build_object('code','CREDIT_RESERVED','cost',r.cost);
end $$;
create or replace function public.reserve_notification_credit(p_outbox uuid,p_worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'SMS worker requires segment-aware adapter' using errcode='22023'; end $$;
create function public.reserve_notification_credit(p_outbox uuid,p_worker text,p_segments integer,p_body_hash text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.notification_outbox;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker access required' using errcode='42501'; end if;
 select * into n from public.notification_outbox where id=p_outbox for update;
 if n.id is null or n.status<>'processing' or n.locked_by is distinct from p_worker then return jsonb_build_object('code','CLAIM_INACTIVE'); end if;
 if n.channel<>'sms' then return jsonb_build_object('code','CREDIT_NOT_REQUIRED'); end if;
 if p_segments is null or p_segments not between 1 and 1000 or p_body_hash is null or p_body_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid SMS segments' using errcode='22023'; end if;
 return public.reserve_credit_operation(n.organization_id,'sms_notification',n.id,n.deduplication_key,
 jsonb_build_object('source',n.id,'key',n.deduplication_key,'template',n.template_key,'payload',n.payload,'recipient',n.recipient_address,'segments',p_segments,'bodyHash',p_body_hash));
end $$;
revoke all on function public.reserve_notification_credit(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_notification_credit(uuid,text,integer,text) to service_role;
drop function public.public_plan_catalog();
create function public.public_plan_catalog() returns table(id text,name text,monthly_price_centavos bigint,yearly_price_centavos bigint,is_custom boolean,limits jsonb,features jsonb,monthly_credits integer,credit_grant_policy text,one_time_credits integer)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.name,p.monthly_price_centavos::bigint,p.yearly_price_centavos::bigint,p.is_custom,p.limits,p.features,p.monthly_credits,p.credit_grant_policy,p.one_time_credits from public.plans p where p.is_active order by p.sort_order,p.id
$$;
revoke all on function public.public_plan_catalog() from public;
grant execute on function public.public_plan_catalog() to anon,authenticated,service_role;
create or replace function public.get_credit_notices(p_org uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare balance jsonb;
begin
 if not public.has_org_role(p_org,array['owner']::public.organization_role[]) then raise exception 'Billing access required' using errcode='42501'; end if;
 perform public.ensure_credit_period(p_org); perform public.notify_credit_threshold(p_org);
 balance:=public.credit_balance_data(p_org);
 return coalesce((select jsonb_agg(to_jsonb(n) order by n."createdAt" desc) from (
  select id,kind,(balance->>'remaining')::integer remaining,balance->>'nextRefresh' "nextRefresh",public.effective_entitlements(p_org)->>'planName' "planName",created_at "createdAt",read_at "readAt" from public.organization_in_app_notices where organization_id=p_org and recipient_id=auth.uid() and period_key=balance->>'periodKey' and kind=balance->>'status' order by created_at desc limit 20
 )n),'[]');
end $$;
create or replace function public.sync_configured_credit_periods(p_limit integer default 100) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; count integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 1000 then raise exception 'Invalid batch size' using errcode='22023'; end if;
 for org in select o.id from public.organizations o join public.plans p on p.id=public.effective_entitlements(o.id)->>'planId' where o.status='active' and p.monthly_credits is not null and p.credit_grant_policy is not null
 and (p.credit_grant_policy='calendar_month_utc' or exists(select 1 from public.organization_subscriptions s where s.organization_id=o.id and s.plan_id=p.id and s.current_period_start<=now() and s.current_period_end>now()))
 and coalesce((select sum(g.allowance) from public.organization_credit_grants g where g.organization_id=o.id and g.credit_class='plan' and g.period_start<=now() and g.period_end>now()),0)<p.monthly_credits
 order by (select max(created_at) from public.organization_credit_grants g where g.organization_id=o.id and g.credit_class='plan') nulls first,o.id limit p_limit loop
  perform public.ensure_credit_period(org); count:=count+1;
 end loop;
 return count;
end $$;
notify pgrst,'reload schema';
commit;
