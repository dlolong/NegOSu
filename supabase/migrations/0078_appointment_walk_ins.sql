-- Salon and Pet Care arrivals use the shared appointment lifecycle.
-- A request key makes retries atomic without creating vehicle queue entries.
alter table public.appointments add column walk_in_request_id uuid;
create unique index appointments_walk_in_request_unique
  on public.appointments(organization_id, walk_in_request_id)
  where walk_in_request_id is not null;

create function public.create_appointment_walk_in(
  p_request_id uuid, p_branch_id uuid, p_customer_id uuid, p_pet_id uuid,
  p_service_ids uuid[], p_staff_ids uuid[] default '{}', p_resource_ids uuid[] default '{}',
  p_customer_note text default null, p_internal_note text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  branch public.branches;
  industry text;
  saved public.appointments;
  saved_id uuid;
  owner_id uuid;
  hours jsonb;
  local_start timestamp;
  local_end timestamp;
begin
  select * into branch from public.branches where id=p_branch_id and is_active;
  select o.industry into industry from public.organizations o where o.id=branch.organization_id and o.status='active';
  if auth.uid() is null or branch.id is null or industry is null or industry not in ('salon','pet_care')
    or not public.has_org_role(branch.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(branch.organization_id,branch.id)
  then raise exception 'Walk-in access denied' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Walk-in request is required' using errcode='22023'; end if;
  if length(coalesce(p_customer_note,''))>2000 or length(coalesce(p_internal_note,''))>2000
    or coalesce(cardinality(p_service_ids),0) not between 1 and 50
    or coalesce(cardinality(p_staff_ids),0)>50 or coalesce(cardinality(p_resource_ids),0)>50
  then raise exception 'Invalid walk-in details' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(branch.organization_id::text||':walk-in:'||p_request_id::text,0));
  select * into saved from public.appointments where organization_id=branch.organization_id and walk_in_request_id=p_request_id;
  if saved.id is not null then
    if saved.branch_id<>branch.id or saved.created_by is distinct from auth.uid()
    then raise exception 'Walk-in request belongs to another visit' using errcode='42501'; end if;
    return saved.id;
  end if;

  if industry='pet_care' then
    select customer_id into owner_id from public.pet_profiles where id=p_pet_id and organization_id=branch.organization_id and is_active;
    if owner_id is null then raise exception 'Pet is unavailable'; end if;
    saved_id:=public.save_pet_appointment(p_pet_id,null,branch.id,p_service_ids,now(),coalesce(p_staff_ids,'{}'),coalesce(p_resource_ids,'{}'),p_customer_note,p_internal_note);
  else
    if p_pet_id is not null then raise exception 'Invalid walk-in details' using errcode='22023'; end if;
    if not exists(select 1 from public.customers where id=p_customer_id and organization_id=branch.organization_id and not is_archived)
    then raise exception 'Walk-in customer is unavailable'; end if;
    saved_id:=public.save_appointment_with_staff(null,branch.id,p_customer_id,null,p_service_ids,now(),coalesce(p_staff_ids,'{}'),coalesce(p_resource_ids,'{}'),p_customer_note,p_internal_note,false);
  end if;

  select * into saved from public.appointments where id=saved_id;
  local_start:=saved.starts_at at time zone branch.timezone;
  local_end:=saved.ends_at at time zone branch.timezone;
  hours:=branch.opening_hours->lower(trim(to_char(local_start,'Day')));
  if local_end is null or hours is null or coalesce((hours->>'closed')::boolean,false)
    or hours->>'open' is null or hours->>'close' is null or local_start::date<>local_end::date
    or local_start::time<(hours->>'open')::time or local_end::time>(hours->>'close')::time
  then raise exception 'Walk-in is outside branch hours'; end if;

  update public.appointments set source='walk_in',walk_in_request_id=p_request_id where id=saved_id;
  if industry='pet_care' then perform public.transition_pet_appointment(saved_id,'arrive');
  else perform public.transition_salon_appointment(saved_id,'arrive'); end if;
  return saved_id;
end $$;
revoke all on function public.create_appointment_walk_in(uuid,uuid,uuid,uuid,uuid[],uuid[],uuid[],text,text) from public,anon;
grant execute on function public.create_appointment_walk_in(uuid,uuid,uuid,uuid,uuid[],uuid[],uuid[],text,text) to authenticated;
comment on function public.create_appointment_walk_in(uuid,uuid,uuid,uuid,uuid[],uuid[],uuid[],text,text) is
  'Creates and checks in a Salon or Pet Care walk-in atomically with server time, scheduling validation and scoped retry identity.';
