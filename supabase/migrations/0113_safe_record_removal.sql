begin;

-- Removal is limited to this allowlist. Referenced records are retained, even
-- when their foreign keys permit cascading deletes or setting references null.
create function public.remove_business_record(p_org uuid,p_branch uuid,p_kind text,p_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare target text; record_data jsonb; referenced boolean:=false; linked boolean; fk record; predicate text; outcome text;
begin
 target:=case p_kind when 'product' then 'inventory_items' when 'promo' then 'commerce_promos'
  when 'staff' then 'organization_staff_profiles' when 'room' then 'hospitality_rooms'
  when 'service' then 'services' when 'resource' then 'scheduling_resources' end;
 if target is null or auth.uid() is null or not public.has_org_role(p_org,array['owner','manager']::public.organization_role[])
  or not public.can_access_branch(p_org,p_branch) or not exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active)
  or not exists(select 1 from public.organizations where id=p_org and status='active')
 then raise exception 'Removal access required' using errcode='42501'; end if;
 if p_kind='staff' and not public.has_permission(p_org,'staff.manage') then raise exception 'Staff management required' using errcode='42501'; end if;
 -- Serialize catalog JSON references with promo validation, which does not use foreign keys.
 if p_kind in ('product','service') then lock table public.commerce_promos in share row exclusive mode; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 and organization_id=$2 for update',target) into record_data using p_id,p_org;
 if record_data is null then raise exception 'Record unavailable' using errcode='42501'; end if;
 if record_data ? 'branch_id' and (record_data->>'branch_id')::uuid is distinct from p_branch then raise exception 'Branch access required' using errcode='42501'; end if;
 -- Organization-wide definitions require access to every active branch.
 if p_kind in ('staff','service') and exists(select 1 from public.branches where organization_id=p_org and is_active and not public.can_access_branch(p_org,id)) then raise exception 'Organization access required' using errcode='42501'; end if;
 if p_kind='room' and exists(select 1 from public.hospitality_stays where room_id=p_id and checked_out_at is null) then raise exception 'Occupied room cannot be removed' using errcode='22023'; end if;
 if p_kind='staff' then
  perform 1 from public.organization_memberships where id=(record_data->>'membership_id')::uuid for update;
  if exists(select 1 from public.organization_memberships where id=(record_data->>'membership_id')::uuid and (role='owner' or user_id=auth.uid())) then raise exception 'Owner or own profile cannot be removed' using errcode='22023'; end if;
  referenced:=record_data->>'membership_id' is not null;
 end if;
 -- Inspect all FK relationships, including composite tenant/branch keys.
 for fk in select * from pg_constraint where contype='f' and confrelid=to_regclass('public.'||target) loop
  select string_agg(format('r.%I=t.%I',a.attname,b.attname),' and ') into predicate
  from unnest(fk.conkey,fk.confkey) k(source,target)
  join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.source
  join pg_attribute b on b.attrelid=fk.confrelid and b.attnum=k.target;
  execute format('select exists(select 1 from %s r join public.%I t on %s where t.id=$1)',fk.conrelid::regclass,target,predicate) into linked using p_id;
  referenced:=referenced or linked;
 end loop;
 if p_kind in ('product','service') then
  referenced:=referenced or exists(select 1 from public.commerce_promos p, jsonb_array_elements(p.components) c where c->>'referenceId'=p_id::text);
 end if;
 if referenced then
  if p_kind='promo' then
   if record_data->>'status'<>'archived' then update public.commerce_promos set status='archived' where id=p_id; end if;
  else execute format('update public.%I set is_active=false where id=$1',target) using p_id;
  end if;
  if p_kind='staff' then
   update public.organization_memberships set is_active=false where id=(record_data->>'membership_id')::uuid and organization_id=p_org;
   update public.staff_invitations set status='revoked',revoked_at=now() where staff_profile_id=p_id and status='pending';
  end if;
  outcome:='archived';
 else
  execute format('delete from public.%I where id=$1',target) using p_id;
  outcome:='deleted';
 end if;
 insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type)
 values(p_org,auth.uid(),p_kind,p_id,p_kind||'.'||outcome);
 return outcome;
end $$;
revoke all on function public.remove_business_record(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.remove_business_record(uuid,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
