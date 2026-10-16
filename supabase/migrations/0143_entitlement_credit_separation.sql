-- Premium access is a plan entitlement; credits never unlock it.
begin;
alter table public.plans add column monthly_credits integer check(monthly_credits is null or monthly_credits between 0 and 10000000);
comment on column public.plans.monthly_credits is 'NULL means commercial allowance not configured; no guessed production grant.';
create or replace function public.effective_entitlements(p_organization_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select public.plan_entitlements(p_organization_id)||jsonb_build_object('monthlyCredits',(select monthly_credits from public.plans where id=public.plan_entitlements(p_organization_id)->>'planId'))
$$;
create or replace function public.get_org_entitlements(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_org_member(p_organization_id) then raise exception 'Organization not found' using errcode='42501'; end if;
 return public.effective_entitlements(p_organization_id);
end $$;
alter function public.generate_credit_report(uuid,uuid,jsonb) rename to generate_report_snapshot_data;
revoke all on function public.generate_report_snapshot_data(uuid,uuid,jsonb) from public,anon,authenticated;
create function public.generate_credit_report(p_org uuid,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 if not public.has_entitlement(p_org,'advanced_reports') then
  insert into public.audit_events(organization_id,actor_user_id,entity_type,event_type,metadata) values(p_org,auth.uid(),'entitlement','feature.denied','{"feature":"advanced_reports"}');
  return jsonb_build_object('code','FEATURE_NOT_ENTITLED');
 end if;
 return public.generate_report_snapshot_data(p_org,p_request,p_payload);
end $$;
revoke all on function public.generate_credit_report(uuid,uuid,jsonb) from public,anon;
grant execute on function public.generate_credit_report(uuid,uuid,jsonb) to authenticated;
create or replace function public.authorize_report_scope(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid,p_financial boolean)
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
  if p_financial and exists(select 1 from public.organizations where id=p_organization_id and financial_report_roles_only)
    and not public.has_org_role(p_organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]) then
    raise exception 'Financial reporting access required' using errcode='42501';
  end if;
  advanced:=public.has_entitlement(p_organization_id,'advanced_reports');
  if not advanced and (p_branch_id is null or p_start_date<branch_today-30 or p_end_date>branch_today) then
    raise exception 'Free reports require one branch and dates within the last 31 days' using errcode='42501';
  end if;
  return advanced;
end $$;

revoke all on function public.authorize_report_scope(uuid,date,date,uuid,boolean) from public,anon,authenticated;
create or replace function public.authorize_report_scope(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id,true);
$$;
create or replace function public.can_upload_business_image(p_name text,p_metadata jsonb) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid; intent_request uuid;
begin
 if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$' then return false; end if;
 begin org:=split_part(p_name,'/',1)::uuid; intent_request:=split_part(split_part(p_name,'/',2),'.',1)::uuid; exception when invalid_text_representation then return false; end;
 if not public.has_org_role(org,array['owner','manager']::public.organization_role[]) then return false; end if;
 return coalesce((public.plan_entitlements(org)->'features'->>'image_uploads')::boolean,false)
;
end $$;
create or replace function public.enforce_business_image_quota() returns trigger
language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare org uuid; ent jsonb; quota bigint; used bigint; incoming bigint; op public.trial_credit_operations; balance integer; charge integer;
begin
 if new.bucket_id<>'business-images' then return new; end if;
 org:=split_part(new.name,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended('business-images:'||org::text,0));
 ent:=public.plan_entitlements(org);
 if not coalesce((ent->'features'->>'image_uploads')::boolean,false) then raise exception 'Image uploads require an eligible plan' using errcode='42501'; end if;
 charge:=0;
 select * into op from public.trial_credit_operations where organization_id=org and request_id=split_part(split_part(new.name,'/',2),'.',1)::uuid and feature='image_upload' and payload->>'path'=new.name;
 if charge=1 and op.request_id is null then raise exception 'Image uploads require an eligible plan' using errcode='42501'; end if;
 if op.request_id is not null then
  -- Storage final persistence may run without auth.uid(); recheck the intent actor explicitly.
  if not exists(select 1 from public.organization_memberships where organization_id=org and user_id=op.actor_id and is_active and role in('owner','manager')) then raise exception 'Settings access required' using errcode='42501'; end if;
  select remaining into balance from public.trial_credit_accounts where organization_id=org for update;
  if tg_op='INSERT' and charge>coalesce((op.payload->>'maxCost')::integer,1) then raise exception 'Plan access changed' using errcode='P0002'; end if;
  if tg_op='INSERT' and (op.completed or balance<charge) then raise exception 'Upload already completed or credits exhausted' using errcode='42501'; end if;
 end if;
 quota:=case when charge=1 then 200 else (ent->'limits'->>'storage_mb')::bigint end;
 incoming:=coalesce((new.metadata->>'size')::bigint,(new.metadata->>'contentLength')::bigint,2097152);
 if quota is null or incoming<1 or incoming>2097152 then raise exception 'Invalid image size or storage allowance' using errcode='23514'; end if;
 select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into used from storage.objects
 where bucket_id='business-images' and split_part(name,'/',1)=org::text and name<>new.name;
 if quota<>-1 and used+incoming>quota*1048576 then raise exception 'Image storage limit reached' using errcode='23514'; end if;
 if tg_op='INSERT' and op.request_id is not null then
  update public.trial_credit_accounts set remaining=remaining-charge where organization_id=org;
  update public.trial_credit_operations set completed=true,cost=charge where organization_id=org and request_id=op.request_id;
 end if;
 return new;
end $$;

alter function public.prepare_credit_image(uuid,uuid,text,text,integer) rename to prepare_image_intent_data;
revoke all on function public.prepare_image_intent_data(uuid,uuid,text,text,integer) from public,anon,authenticated;
create function public.prepare_credit_image(p_org uuid,p_request uuid,p_hash text,p_extension text,p_max_cost integer default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) then raise exception 'Settings access required' using errcode='42501'; end if;
 if not public.has_entitlement(p_org,'image_uploads') then
  insert into public.audit_events(organization_id,actor_user_id,entity_type,event_type,metadata) values(p_org,auth.uid(),'entitlement','feature.denied','{"feature":"image_uploads"}');
  return jsonb_build_object('code','FEATURE_NOT_ENTITLED');
 end if;
 return public.prepare_image_intent_data(p_org,p_request,p_hash,p_extension,0);
end $$;
revoke all on function public.prepare_credit_image(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.prepare_credit_image(uuid,uuid,text,text,integer) to authenticated;
-- Existing historical snapshots stay readable under their original user/branch checks.
notify pgrst,'reload schema';
commit;
