-- Extend the existing one-time account with an auditable, lot-based ledger.
-- No new commercial prices or recurring grants are configured by this migration.
begin;
alter table public.plans add column credit_grant_policy text check(credit_grant_policy in('calendar_month_utc','subscription_month'));
create table public.credit_operation_registry (
 operation_key text primary key, label text not null, entitlement text,
 credit_cost integer check(credit_cost between 0 and 1000000), enabled boolean not null default false,
 billable_event text not null check(billable_event in('provider_accepted','operation_committed')), failure_policy text not null default 'release_before_acceptance'
);
insert into public.credit_operation_registry(operation_key,label,entitlement,credit_cost,enabled,billable_event)
 values('sms_notification','SMS notification','reminders',null,false,'provider_accepted');
alter table public.credit_operation_registry enable row level security;
revoke all on public.credit_operation_registry from public,anon,authenticated;
create table public.organization_credit_grants (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 credit_class text not null check(credit_class in('one_time','plan','purchased')), grant_key text not null,
 allowance integer not null check(allowance>=0), period_start timestamptz, period_end timestamptz, expires_at timestamptz,
 created_at timestamptz not null default now(), unique(organization_id,grant_key), unique(organization_id,id),
 check(period_end is null or period_end>period_start), check(credit_class<>'purchased' or expires_at is null)
);
create table public.organization_credit_reservations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 operation_key text not null references public.credit_operation_registry(operation_key), source_id uuid not null,
 idempotency_key text not null check(length(idempotency_key) between 1 and 200), payload_hash text not null,
 cost integer not null check(cost>0), status text not null check(status in('reserved','committed','released')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,operation_key,idempotency_key), unique(organization_id,id), unique(operation_key,source_id)
);
create table public.organization_credit_allocations (
 organization_id uuid not null, reservation_id uuid not null, grant_id uuid not null, amount integer not null check(amount>0),
 primary key(reservation_id,grant_id),
 foreign key(organization_id,reservation_id) references public.organization_credit_reservations(organization_id,id) on delete cascade,
 foreign key(organization_id,grant_id) references public.organization_credit_grants(organization_id,id) on delete cascade
);
create table public.organization_credit_ledger (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 grant_id uuid, reservation_id uuid, transaction_type text not null check(transaction_type in('GRANT','USAGE','RELEASE','REFUND','ADJUSTMENT','EXPIRATION')),
 amount integer not null, reason_code text not null, operation_key text references public.credit_operation_registry(operation_key),
 idempotency_key text not null, created_at timestamptz not null default now(), created_by uuid,
 foreign key(organization_id,grant_id) references public.organization_credit_grants(organization_id,id) on delete cascade,
 foreign key(organization_id,reservation_id) references public.organization_credit_reservations(organization_id,id) on delete cascade,
 unique(organization_id,idempotency_key),
 check((transaction_type in('GRANT','REFUND') and amount>0) or (transaction_type in('USAGE','EXPIRATION') and amount<0) or (transaction_type='RELEASE' and amount=0) or transaction_type='ADJUSTMENT')
);
create index organization_credit_ledger_history on public.organization_credit_ledger(organization_id,created_at desc,id);
create index organization_credit_ledger_grant on public.organization_credit_ledger(grant_id);
create index organization_credit_reserved on public.organization_credit_reservations(organization_id) where status='reserved';
-- The existing notification bell receives durable billing notices with recipient/read state.
create table public.organization_in_app_notices (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade, period_key text not null,
 kind text not null check(kind in('LOW','CRITICAL','EMPTY')), remaining integer not null check(remaining>=0),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(organization_id,recipient_id,period_key,kind)
);
create index organization_in_app_notices_unread on public.organization_in_app_notices(organization_id,recipient_id,created_at desc) where read_at is null;
alter table public.organization_credit_grants enable row level security;
alter table public.organization_credit_reservations enable row level security;
alter table public.organization_credit_allocations enable row level security;
alter table public.organization_credit_ledger enable row level security;
alter table public.organization_in_app_notices enable row level security;
revoke all on public.organization_credit_grants,public.organization_credit_reservations,public.organization_credit_allocations,public.organization_credit_ledger,public.organization_in_app_notices from public,anon,authenticated;

create function public.credit_status(p_remaining bigint,p_allowance bigint) returns text language sql immutable as $$
 select case when p_remaining<=0 then 'EMPTY' when p_remaining<=greatest(1,floor(p_allowance*.10)) then 'CRITICAL' when p_remaining<=greatest(2,floor(p_allowance*.20)) then 'LOW' else 'NORMAL' end
$$;
revoke all on function public.credit_status(bigint,bigint) from public,anon,authenticated;
create function public.credit_lot_balance(p_grant uuid) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(sum(amount),0) from public.organization_credit_ledger where grant_id=p_grant
$$;
create function public.credit_lot_held(p_grant uuid) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(sum(a.amount),0) from public.organization_credit_allocations a join public.organization_credit_reservations r on r.id=a.reservation_id and r.organization_id=a.organization_id where a.grant_id=p_grant and r.status='reserved'
$$;
revoke all on function public.credit_lot_balance(uuid),public.credit_lot_held(uuid) from public,anon,authenticated;
create function public.ensure_credit_period(p_org uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare opening integer; g public.organization_credit_grants; ent jsonb; configured integer; policy text; sub public.organization_subscriptions;
 period_begin timestamptz; period_finish timestamptz; anchor_months integer; expired bigint;
begin
 -- Reuse the previous account row as the business-wide mutex and exact opening balance.
 insert into public.trial_credit_accounts(organization_id) values(p_org) on conflict do nothing;
 select remaining into opening from public.trial_credit_accounts where organization_id=p_org for update;
 insert into public.organization_credit_grants(organization_id,credit_class,grant_key,allowance)
 values(p_org,'one_time','approved-one-time',100) on conflict do nothing returning * into g;
 if found and opening>0 then
  insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
  values(p_org,g.id,'GRANT',opening,'existing_one_time_balance','opening-one-time');
 end if;
 ent:=public.effective_entitlements(p_org);
 select monthly_credits,credit_grant_policy into configured,policy from public.plans where id=ent->>'planId';
 if configured is not null and policy is not null then
  if policy='calendar_month_utc' then
   period_begin:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'; period_finish:=period_begin+interval '1 month';
  else
   select * into sub from public.organization_subscriptions where organization_id=p_org and plan_id=ent->>'planId';
   if sub.current_period_start is not null and sub.current_period_end>now() and sub.current_period_start<=now() then
    anchor_months:=(extract(year from age(now(),sub.current_period_start))*12+extract(month from age(now(),sub.current_period_start)))::integer;
    period_begin:=sub.current_period_start+make_interval(months=>anchor_months);
    period_finish:=least(sub.current_period_start+make_interval(months=>anchor_months+1),sub.current_period_end);
   end if;
  end if;
  -- No mid-window proration/top-up: overlapping authoritative windows do not grant twice.
  if period_begin is not null and period_finish>now() and not exists(select 1 from public.organization_credit_grants where organization_id=p_org and credit_class='plan' and period_start<period_finish and period_end>period_begin) then
   insert into public.organization_credit_grants(organization_id,credit_class,grant_key,allowance,period_start,period_end,expires_at)
   values(p_org,'plan','plan:'||extract(epoch from period_begin)::text,configured,period_begin,period_finish,period_finish) on conflict do nothing returning * into g;
   if found and configured>0 then insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
    values(p_org,g.id,'GRANT',configured,'configured_period_allowance','grant:'||g.id); end if;
  end if;
 end if;
 -- Expire only unused plan credits. Reserved allocations remain held until resolved.
 for g in select * from public.organization_credit_grants where organization_id=p_org and credit_class='plan' and expires_at<=now() loop
  expired:=public.credit_lot_balance(g.id)-public.credit_lot_held(g.id);
  if expired>0 then insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
   values(p_org,g.id,'EXPIRATION',-expired,'period_ended','expire:'||g.id||':'||public.credit_lot_balance(g.id)); end if;
 end loop;
end $$;
revoke all on function public.ensure_credit_period(uuid) from public,anon,authenticated;
create function public.credit_balance_data(p_org uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with lots as (
  select g.*,public.credit_lot_balance(g.id) balance,public.credit_lot_held(g.id) held from public.organization_credit_grants g where organization_id=p_org and (expires_at is null or expires_at>now())
 ), totals as (
  select coalesce(sum(balance-held),0)::bigint remaining,(case when count(*) filter(where credit_class='plan')>0 then coalesce(sum(allowance) filter(where credit_class='plan'),0)+coalesce(sum(greatest(balance-held,0)) filter(where credit_class<>'plan'),0) else coalesce(sum(allowance) filter(where credit_class='one_time'),100)+coalesce(sum(greatest(balance-held,0)) filter(where credit_class='purchased'),0) end)::bigint allowance,
   (select coalesce(sum(public.credit_lot_held(id)),0) from public.organization_credit_grants where organization_id=p_org)::bigint held,
   coalesce(sum(balance-held) filter(where credit_class='one_time'),0)::bigint one_time,coalesce(sum(balance-held) filter(where credit_class='plan'),0)::bigint included,
   coalesce(sum(allowance) filter(where credit_class='plan'),0)::bigint included_allowance,max(period_start) period_start,max(period_end) period_end
  from lots
 ) select jsonb_build_object('remaining',remaining,'allowance',allowance,'reserved',held,'oneTimeRemaining',one_time,'monthlyRemaining',included,'monthlyAllowance',included_allowance,
  'periodStart',period_start,'nextRefresh',period_end,'periodKey',coalesce('plan:'||extract(epoch from period_start)::text,'one-time'),
  'status',public.credit_status(remaining,allowance)) from totals
$$;
revoke all on function public.credit_balance_data(uuid) from public,anon,authenticated;
create function public.notify_credit_threshold(p_org uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare balance jsonb; level text;
begin
 balance:=public.credit_balance_data(p_org); level:=balance->>'status';
 if level='NORMAL' then return; end if;
 insert into public.organization_in_app_notices(organization_id,recipient_id,period_key,kind,remaining)
 select p_org,m.user_id,balance->>'periodKey',level,(balance->>'remaining')::integer from public.organization_memberships m where m.organization_id=p_org and m.is_active and m.role='owner' on conflict do nothing;
end $$;
revoke all on function public.notify_credit_threshold(uuid) from public,anon,authenticated;
create function public.get_credit_usage(p_org uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_org_role(p_org,array['owner']::public.organization_role[]) then raise exception 'Billing access required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'Invalid usage page' using errcode='22023'; end if;
 perform public.ensure_credit_period(p_org); perform public.notify_credit_threshold(p_org);
 result:=public.credit_balance_data(p_org);
 return result||jsonb_build_object('count',(select count(*) from public.organization_credit_ledger where organization_id=p_org),'history',coalesce((select jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id) from (
  select l.id,l.created_at "createdAt",l.transaction_type status,l.amount,case l.reason_code when 'existing_one_time_balance' then 'One-time opening balance' when 'configured_period_allowance' then 'Plan period allowance' when 'period_ended' then 'Unused plan credits expired' else coalesce(r.label,'Credit activity') end activity
  from public.organization_credit_ledger l left join public.credit_operation_registry r on r.operation_key=l.operation_key where l.organization_id=p_org order by l.created_at desc,l.id limit 25 offset (p_page-1)*25
 )x),'[]'));
end $$;
revoke all on function public.get_credit_usage(uuid,integer) from public,anon;
grant execute on function public.get_credit_usage(uuid,integer) to authenticated;

create function public.reserve_credit_operation(p_org uuid,p_operation text,p_source uuid,p_request text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
 needed:=coalesce(r.cost,config.credit_cost);
 if (balance->>'remaining')::bigint<needed then perform public.notify_credit_threshold(p_org); return jsonb_build_object('code','INSUFFICIENT_CREDITS','required',needed,'remaining',balance->'remaining'); end if;
 if r.id is null then
  insert into public.organization_credit_reservations(organization_id,operation_key,source_id,idempotency_key,payload_hash,cost,status)
  values(p_org,config.operation_key,p_source,p_request,hash,needed,'reserved') returning * into r;
 else
  delete from public.organization_credit_allocations where reservation_id=r.id;
  update public.organization_credit_reservations set status='reserved',updated_at=now() where id=r.id;
 end if;
 for g in select * from public.organization_credit_grants where organization_id=p_org and (expires_at is null or expires_at>now()) order by expires_at nulls last,created_at,id loop
  available:=public.credit_lot_balance(g.id)-public.credit_lot_held(g.id); take:=least(needed,available);
  if take>0 then insert into public.organization_credit_allocations values(p_org,r.id,g.id,take); needed:=needed-take; end if;
  exit when needed=0;
 end loop;
 if needed<>0 then raise exception 'Credit allocation mismatch' using errcode='23514'; end if;
 perform public.notify_credit_threshold(p_org);
 return jsonb_build_object('code','CREDIT_RESERVED','cost',r.cost);
end $$;
-- Only a checked domain adapter can invoke this generic engine boundary.
revoke all on function public.reserve_credit_operation(uuid,text,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.reserve_notification_credit(p_outbox uuid,p_worker text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.notification_outbox;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker access required' using errcode='42501'; end if;
 select * into n from public.notification_outbox where id=p_outbox for update;
 if n.id is null or n.status<>'processing' or n.locked_by is distinct from p_worker then return jsonb_build_object('code','CLAIM_INACTIVE'); end if;
 if n.channel<>'sms' then return jsonb_build_object('code','CREDIT_NOT_REQUIRED'); end if;
 return public.reserve_credit_operation(n.organization_id,'sms_notification',n.id,n.deduplication_key,jsonb_build_object('source',n.id,'key',n.deduplication_key,'template',n.template_key,'payload',n.payload,'recipient',n.recipient_address));
end $$;
revoke all on function public.reserve_notification_credit(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_notification_credit(uuid,text) to service_role;

create function public.settle_notification_credit(p_outbox uuid,p_outcome text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.organization_credit_reservations; a public.organization_credit_allocations;
begin
 select * into r from public.organization_credit_reservations where source_id=p_outbox and operation_key='sms_notification';
 if r.id is null then return 'CREDIT_NOT_REQUIRED'; end if;
 perform 1 from public.trial_credit_accounts where organization_id=r.organization_id for update;
 select * into r from public.organization_credit_reservations where id=r.id for update;
 if p_outcome not in('committed','released') then raise exception 'Invalid credit outcome' using errcode='22023'; end if;
 if r.status=p_outcome then return 'CREDIT_'||upper(r.status); end if;
 if r.status='committed' then return 'CREDIT_COMMITTED'; end if;
 -- A later unmetered retry has no active reservation to debit.
 if r.status='released' and p_outcome='committed' then return 'CREDIT_NOT_REQUIRED'; end if;
 if p_outcome='committed' then
  for a in select * from public.organization_credit_allocations where reservation_id=r.id loop
   insert into public.organization_credit_ledger(organization_id,grant_id,reservation_id,transaction_type,amount,reason_code,operation_key,idempotency_key)
   values(r.organization_id,a.grant_id,r.id,'USAGE',-a.amount,'provider_accepted',r.operation_key,'usage:'||r.id||':'||a.grant_id) on conflict do nothing;
  end loop;
 else
  insert into public.organization_credit_ledger(organization_id,reservation_id,transaction_type,amount,reason_code,operation_key,idempotency_key)
  values(r.organization_id,r.id,'RELEASE',0,'not_accepted',r.operation_key,'release:'||r.id||':'||r.updated_at) on conflict do nothing;
 end if;
 update public.organization_credit_reservations set status=p_outcome,updated_at=now() where id=r.id;
 perform public.ensure_credit_period(r.organization_id); perform public.notify_credit_threshold(r.organization_id);
 return 'CREDIT_'||upper(p_outcome);
end $$;
revoke all on function public.settle_notification_credit(uuid,text) from public,anon,authenticated;
-- Trusted provider reconciliation can refund an accepted operation once.
-- Private until a real provider adapter verifies refunds; no client or worker grant.
create function public.refund_notification_credit(p_outbox uuid,p_refund_reference text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.organization_credit_reservations; a public.organization_credit_allocations;
begin
 if p_refund_reference is null or length(btrim(p_refund_reference)) not between 1 and 200 then raise exception 'Refund reference required' using errcode='22023'; end if;
 select * into r from public.organization_credit_reservations where source_id=p_outbox and operation_key='sms_notification';
 if r.id is null or r.status<>'committed' then raise exception 'Accepted credit operation required' using errcode='23514'; end if;
 perform 1 from public.trial_credit_accounts where organization_id=r.organization_id for update;
 if exists(select 1 from public.organization_credit_ledger where reservation_id=r.id and transaction_type='REFUND') then return 'CREDIT_REFUNDED'; end if;
 insert into public.audit_events(organization_id,entity_type,entity_id,event_type,metadata) values(r.organization_id,'credit_operation',r.id,'credit.refunded',jsonb_build_object('referenceHash',encode(sha256(convert_to(p_refund_reference,'UTF8')),'hex')));
 for a in select * from public.organization_credit_allocations where reservation_id=r.id loop
  insert into public.organization_credit_ledger(organization_id,grant_id,reservation_id,transaction_type,amount,reason_code,operation_key,idempotency_key)
  values(r.organization_id,a.grant_id,r.id,'REFUND',a.amount,'provider_refund',r.operation_key,'refund:'||r.id||':'||a.grant_id) on conflict do nothing;
 end loop;
 -- Keep the operation committed, so a retry never sends or consumes again.
 perform public.ensure_credit_period(r.organization_id);
 return 'CREDIT_REFUNDED';
end $$;
revoke all on function public.refund_notification_credit(uuid,text) from public,anon,authenticated,service_role;
-- Settlement stays private; only the checked delivery-result boundary calls it.
alter function public.record_notification_delivery_result(uuid,text,text,text,text,text,text,timestamptz) rename to record_notification_delivery_result_data;
revoke all on function public.record_notification_delivery_result_data(uuid,text,text,text,text,text,text,timestamptz) from public,anon,authenticated,service_role;
create function public.record_notification_delivery_result(
 p_outbox_id uuid,p_worker_id text,p_result text,p_provider text default null,p_provider_message_id text default null,p_error_code text default null,p_error_message text default null,p_next_available_at timestamptz default null
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare result text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker access required' using errcode='42501'; end if;
 result:=public.record_notification_delivery_result_data(p_outbox_id,p_worker_id,p_result,p_provider,p_provider_message_id,p_error_code,p_error_message,p_next_available_at);
 if p_result='sent' then perform public.settle_notification_credit(p_outbox_id,'committed');
 elsif p_error_code in('PROVIDER_REJECTED','CHANNEL_DISABLED','MESSAGE_CONFIGURATION_INVALID','REFERENCE_NO_LONGER_ELIGIBLE','RECIPIENT_OPTED_OUT','RECIPIENT_MISSING','EMAIL_OPTED_OUT','SMS_OPTED_OUT','EMAIL_MISSING','SMS_MISSING') then perform public.settle_notification_credit(p_outbox_id,'released');
 end if;
 -- Ambiguous network/provider outcomes retain their reservation for reconciliation.
 return result;
end $$;
revoke all on function public.record_notification_delivery_result(uuid,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_notification_delivery_result(uuid,text,text,text,text,text,text,timestamptz) to service_role;
create function public.sync_configured_credit_periods(p_limit integer default 100) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; count integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 1000 then raise exception 'Invalid batch size' using errcode='22023'; end if;
 for org in select o.id from public.organizations o join public.plans p on p.id=public.effective_entitlements(o.id)->>'planId' where o.status='active' and p.monthly_credits is not null and p.credit_grant_policy is not null
 and (p.credit_grant_policy='calendar_month_utc' or exists(select 1 from public.organization_subscriptions s where s.organization_id=o.id and s.plan_id=p.id and s.current_period_start<=now() and s.current_period_end>now()))
 and not exists(select 1 from public.organization_credit_grants g where g.organization_id=o.id and g.credit_class='plan' and g.period_start<=now() and g.period_end>now())
 order by (select max(created_at) from public.organization_credit_grants g where g.organization_id=o.id and g.credit_class='plan') nulls first,o.id limit p_limit loop
  perform public.ensure_credit_period(org); count:=count+1;
 end loop;
 return count;
end $$;
revoke all on function public.sync_configured_credit_periods(integer) from public,anon,authenticated;
grant execute on function public.sync_configured_credit_periods(integer) to service_role;
create function public.subscription_credit_period_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.plans where id=public.effective_entitlements(new.organization_id)->>'planId' and monthly_credits is not null and credit_grant_policy is not null) then perform public.ensure_credit_period(new.organization_id); end if;
 return new;
end $$;
revoke all on function public.subscription_credit_period_changed() from public,anon,authenticated;
create trigger subscription_credit_period after insert or update of plan_id,status,current_period_start,current_period_end on public.organization_subscriptions for each row execute function public.subscription_credit_period_changed();

create function public.get_credit_notices(p_org uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare balance jsonb;
begin
 if not public.has_org_role(p_org,array['owner']::public.organization_role[]) then raise exception 'Billing access required' using errcode='42501'; end if;
 perform public.ensure_credit_period(p_org); perform public.notify_credit_threshold(p_org);
 balance:=public.credit_balance_data(p_org);
 return coalesce((select jsonb_agg(to_jsonb(n) order by n."createdAt" desc) from (
  select id,kind,remaining,created_at "createdAt",read_at "readAt" from public.organization_in_app_notices where organization_id=p_org and recipient_id=auth.uid() and period_key=balance->>'periodKey' and kind=balance->>'status' order by created_at desc limit 20
 )n),'[]');
end $$;
create function public.read_credit_notice(p_org uuid,p_notice uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_org_role(p_org,array['owner']::public.organization_role[]) then raise exception 'Billing access required' using errcode='42501'; end if;
 update public.organization_in_app_notices set read_at=coalesce(read_at,now()) where id=p_notice and organization_id=p_org and recipient_id=auth.uid();
 if not found then raise exception 'Notice not found' using errcode='42501'; end if;
end $$;
revoke all on function public.get_credit_notices(uuid),public.read_credit_notice(uuid,uuid) from public,anon;
grant execute on function public.get_credit_notices(uuid),public.read_credit_notice(uuid,uuid) to authenticated;
-- Platform view is read-only. Platform authorization remains in requirePlatformAdmin.
create function public.platform_credit_usage(p_org uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Platform access required' using errcode='42501'; end if;
 perform public.ensure_credit_period(p_org);
 return public.credit_balance_data(p_org)||jsonb_build_object('plan',public.effective_entitlements(p_org)->>'planName','configuredMonthlyCredits',public.effective_entitlements(p_org)->'monthlyCredits');
end $$;
revoke all on function public.platform_credit_usage(uuid) from public,anon,authenticated;
grant execute on function public.platform_credit_usage(uuid) to service_role;
notify pgrst,'reload schema';
commit;
