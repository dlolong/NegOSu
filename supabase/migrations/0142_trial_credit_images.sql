-- Upload intent is free. Charge and Storage metadata commit in the same transaction.
-- Storage's rolled-back preflight therefore never consumes a credit.
begin;
create function public.prepare_credit_image(p_org uuid,p_request uuid,p_hash text,p_extension text,p_max_cost integer default 1) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; payload jsonb; balance integer; paid boolean; member_role public.organization_role; image_path text;
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) then raise exception 'Settings access required' using errcode='42501'; end if;
 if p_max_cost is null or p_max_cost not in(0,1) or p_request is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_extension is null or p_extension not in('jpg','png','webp') then raise exception 'Invalid image request' using errcode='22023'; end if;
 image_path:=p_org::text||'/'||p_request::text||'.'||p_extension;
 payload:=jsonb_build_object('hash',p_hash,'path',image_path,'maxCost',p_max_cost);
 insert into public.trial_credit_accounts(organization_id) values(p_org) on conflict do nothing;
 select remaining into balance from public.trial_credit_accounts where organization_id=p_org for update;
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request;
 if found then
  if op.actor_id<>auth.uid() or op.feature<>'image_upload' or op.payload->>'hash'<>p_hash or op.payload->>'path'<>image_path then raise exception 'Request key already used' using errcode='22023'; end if;
  if op.completed then
   if not exists(select 1 from storage.objects where bucket_id='business-images' and name=image_path) then raise exception 'Image was deleted; choose the file again' using errcode='22023'; end if;
   return jsonb_build_object('path',image_path,'completed',true,'remaining',balance);
  end if;
 end if;
 paid:=coalesce((public.plan_entitlements(p_org)->'features'->>'image_uploads')::boolean,false);
 if not paid and p_max_cost=0 then raise exception 'Plan access changed' using errcode='P0002'; end if;
 if not paid and balance<1 then raise exception 'Trial credits exhausted' using errcode='P0001'; end if;
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 insert into public.trial_credit_operations(organization_id,request_id,actor_id,actor_role,feature,payload)
 values(p_org,p_request,auth.uid(),member_role,'image_upload',payload) on conflict(organization_id,request_id) do update set payload=excluded.payload;
 return jsonb_build_object('path',image_path,'completed',false,'remaining',balance);
end $$;
revoke all on function public.prepare_credit_image(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.prepare_credit_image(uuid,uuid,text,text,integer) to authenticated;
create or replace function public.can_upload_business_image(p_name text,p_metadata jsonb) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid; intent_request uuid;
begin
 if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$' then return false; end if;
 begin org:=split_part(p_name,'/',1)::uuid; intent_request:=split_part(split_part(p_name,'/',2),'.',1)::uuid; exception when invalid_text_representation then return false; end;
 if not public.has_org_role(org,array['owner','manager']::public.organization_role[]) then return false; end if;
 return coalesce((public.plan_entitlements(org)->'features'->>'image_uploads')::boolean,false)
 or exists(select 1 from public.trial_credit_operations op where op.organization_id=org and op.request_id=intent_request and op.actor_id=auth.uid() and op.feature='image_upload' and op.payload->>'path'=p_name
 and (op.completed or exists(select 1 from public.trial_credit_accounts a where a.organization_id=org and a.remaining>0)));
end $$;
create or replace function public.enforce_business_image_quota() returns trigger
language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare org uuid; ent jsonb; quota bigint; used bigint; incoming bigint; op public.trial_credit_operations; balance integer; charge integer;
begin
 if new.bucket_id<>'business-images' then return new; end if;
 org:=split_part(new.name,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended('business-images:'||org::text,0));
 ent:=public.plan_entitlements(org);
 charge:=case when coalesce((ent->'features'->>'image_uploads')::boolean,false) then 0 else 1 end;
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
notify pgrst,'reload schema';
commit;
