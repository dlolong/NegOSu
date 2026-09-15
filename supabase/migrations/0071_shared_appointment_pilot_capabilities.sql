-- Narrow shared appointment capabilities opt in by persisted organization configuration.
create function public.guard_organization_pilot_configuration() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (current_user in('anon','authenticated') or (auth.uid() is not null and coalesce(auth.role(),'')<>'service_role')) and (tg_op='INSERT' and (new.industry='pet_care' or new.pet_care_pilot_enabled or new.appointment_parallel_enabled) or tg_op='UPDATE' and (new.pet_care_pilot_enabled is distinct from old.pet_care_pilot_enabled or new.appointment_parallel_enabled is distinct from old.appointment_parallel_enabled)) then raise exception 'Pilot configuration requires trusted operations' using errcode='42501'; end if;
 return new;
end $$;
create trigger organization_pilot_configuration_guard before insert or update on public.organizations for each row execute function public.guard_organization_pilot_configuration();

CREATE OR REPLACE FUNCTION public.create_appointment_self_service_link(p_appointment_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_secret_ciphertext text DEFAULT NULL::text, p_secret_initialization_vector text DEFAULT NULL::text, p_secret_authentication_tag text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare appointment_row public.appointments; link_id uuid; secret_id uuid; old_link record;
begin
  select appointment.* into appointment_row from public.appointments appointment
  join public.organizations organization on organization.id=appointment.organization_id and (organization.industry='salon' or (organization.industry='pet_care' and organization.pet_care_pilot_enabled)) and organization.status='active'
  where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null
    or not public.has_org_role(appointment_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  if appointment_row.status not in('requested','confirmed') or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at<=now()+interval '1 hour' or p_expires_at>now()+interval '30 days'
  then raise exception 'Appointment cannot be shared'; end if;
  if (p_secret_ciphertext is null)<>(p_secret_initialization_vector is null)
    or (p_secret_ciphertext is null)<>(p_secret_authentication_tag is null)
  then raise exception 'Invalid delivery secret'; end if;
  for old_link in update public.appointment_self_service_links set status='revoked',revoked_at=now()
    where appointment_id=appointment_row.id and status='active' returning id,delivery_secret_id
  loop
    update public.notification_delivery_secrets set ciphertext=null,initialization_vector=null,authentication_tag=null,destroyed_at=now()
      where id=old_link.delivery_secret_id and destroyed_at is null;
  end loop;
  update public.notification_outbox set status='cancelled',eligibility_reason='LINK_REPLACED',cancelled_at=now(),locked_at=null,locked_by=null
    where reference_type='appointment' and reference_id=appointment_row.id and status in('pending','processing');
  if p_secret_ciphertext is not null then
    insert into public.notification_delivery_secrets(organization_id,ciphertext,initialization_vector,authentication_tag,expires_at)
    values(appointment_row.organization_id,p_secret_ciphertext,p_secret_initialization_vector,p_secret_authentication_tag,p_expires_at)
    returning id into secret_id;
  end if;
  insert into public.appointment_self_service_links(organization_id,branch_id,appointment_id,token_hash,expires_at,delivery_secret_id,created_by)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_token_hash,p_expires_at,secret_id,auth.uid()) returning id into link_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(appointment_row.organization_id,auth.uid(),'appointment_self_service_link',link_id,'appointment.self_service_link_created',jsonb_build_object('appointment_id',appointment_row.id,'expires_at',p_expires_at));
  return link_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_appointment_with_staff(p_appointment_id uuid, p_branch_id uuid, p_customer_id uuid, p_vehicle_id uuid, p_service_ids uuid[], p_starts_at timestamp with time zone, p_staff_ids uuid[] DEFAULT '{}'::uuid[], p_resource_ids uuid[] DEFAULT '{}'::uuid[], p_customer_note text DEFAULT NULL::text, p_internal_note text DEFAULT NULL::text, p_allow_conflict boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare branch_org uuid;saved_id uuid;service_id uuid;staff_id uuid;resource_id uuid;current_status public.appointment_status;
  duration integer;service_count integer;requested_end timestamptz;resource_capacity integer;used_capacity integer;
  old_starts_at timestamptz;old_staff uuid[]:='{}';new_staff uuid[]:='{}';old_treatments jsonb:='[]';new_treatments jsonb:='[]';
  previous_suppression text:=coalesce(current_setting('servicecore.suppress_appointment_detail_invalidation',true),'');
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(branch_org,p_branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  if cardinality(p_staff_ids)<>(select count(distinct value) from unnest(p_staff_ids)value) then raise exception 'Duplicate staff assignment'; end if;
  if cardinality(p_resource_ids)<>(select count(distinct value) from unnest(p_resource_ids)value) then raise exception 'Duplicate resource assignment'; end if;
  select count(*),coalesce(sum(duration_minutes),0) into service_count,duration from public.services where organization_id=branch_org and is_active and id=any(p_service_ids);
  if service_count<>(select count(distinct value) from unnest(p_service_ids)value) or duration<=0 then raise exception 'Selected service is unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  if exists(select 1 from unnest(p_staff_ids)sid where not exists(
    select 1 from public.organization_staff_profiles staff where staff.id=sid and staff.organization_id=branch_org and staff.is_active
      and (not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id)
        or exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id and branch.branch_id=p_branch_id))
  )) then raise exception 'Staff member is not allowed at this branch'; end if;
  if exists(select 1 from unnest(p_resource_ids)rid where not exists(select 1 from public.scheduling_resources resource where resource.id=rid and resource.organization_id=branch_org and resource.branch_id=p_branch_id and resource.is_active)) then raise exception 'Scheduling resource is not available at this branch'; end if;
  if not p_allow_conflict and not (select appointment_parallel_enabled from public.organizations where id=branch_org) and exists(select 1 from public.appointments appointment where appointment.organization_id=branch_org and appointment.branch_id=p_branch_id and appointment.id is distinct from p_appointment_id and appointment.status in('requested','confirmed','checked_in','in_service','queued') and appointment.starts_at<requested_end and appointment.ends_at>p_starts_at) then raise exception 'Another appointment overlaps this time'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointment_staff_assignments assignment join public.appointments appointment on appointment.id=assignment.appointment_id where assignment.staff_profile_id=any(p_staff_ids) and appointment.id is distinct from p_appointment_id and appointment.status in('requested','confirmed','checked_in','in_service','queued') and appointment.starts_at<requested_end and appointment.ends_at>p_starts_at) then raise exception 'A selected staff member is busy'; end if;
  if not p_allow_conflict then foreach resource_id in array p_resource_ids loop
    select capacity into resource_capacity from public.scheduling_resources where id=resource_id;
    select public.appointment_resource_peak(resource_id,p_starts_at,requested_end,p_appointment_id) into used_capacity;
    if used_capacity+1>resource_capacity then raise exception 'Scheduling resource capacity exceeded'; end if;
  end loop; end if;
  if p_appointment_id is not null then
    select starts_at into old_starts_at from public.appointments where id=p_appointment_id;
    select coalesce(array_agg(staff_profile_id order by staff_profile_id),'{}') into old_staff from public.appointment_staff_assignments where appointment_id=p_appointment_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]') into old_treatments from public.appointment_services where appointment_id=p_appointment_id;
  end if;
  perform set_config('servicecore.suppress_appointment_detail_invalidation','on',true);
  begin
    if p_appointment_id is null then
      insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,internal_note,created_by)
      values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'requested','internal',p_starts_at,nullif(trim(coalesce(p_customer_note,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),auth.uid()) returning id into saved_id;
    else
      select status into current_status from public.appointments where id=p_appointment_id and organization_id=branch_org for update;
      if current_status not in('requested','confirmed') then raise exception 'This appointment can no longer be edited'; end if;
      update public.appointments set branch_id=p_branch_id,customer_id=p_customer_id,vehicle_id=p_vehicle_id,starts_at=p_starts_at,customer_note=nullif(trim(coalesce(p_customer_note,'')),''),internal_note=nullif(trim(coalesce(p_internal_note,'')),'') where id=p_appointment_id;
      if not found then raise exception 'Appointment not found' using errcode='42501'; end if;
      saved_id:=p_appointment_id;
      delete from public.appointment_services where appointment_id=saved_id;
      delete from public.appointment_staff_assignments where appointment_id=saved_id;
      delete from public.appointment_resource_assignments where appointment_id=saved_id;
    end if;
    foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes)values(saved_id,service_id,'pending',0,1);end loop;
    foreach staff_id in array p_staff_ids loop insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id)values(branch_org,saved_id,staff_id);end loop;
    foreach resource_id in array p_resource_ids loop insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id)values(branch_org,saved_id,resource_id);end loop;
  exception when others then perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);raise; end;
  perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);
  if p_appointment_id is not null then
    select coalesce(array_agg(staff_profile_id order by staff_profile_id),'{}') into new_staff from public.appointment_staff_assignments where appointment_id=saved_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]') into new_treatments from public.appointment_services where appointment_id=saved_id;
    if old_starts_at is not distinct from p_starts_at and (old_staff is distinct from new_staff or old_treatments is distinct from new_treatments)
      then perform public.invalidate_appointment_reminder_generation(saved_id,'APPOINTMENT_DETAILS_CHANGED'); end if;
  end if;
  return saved_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_public_appointment_self_service(p_token_hash text, p_action text, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare link_row public.appointment_self_service_links; appointment_row public.appointments; duration integer; requested_end timestamptz; local_start timestamp; hours jsonb; open_time time; close_time time;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_action not in('confirm','reschedule')
  then return jsonb_build_object('state','invalid'); end if;
  select * into link_row from public.appointment_self_service_links where token_hash=p_token_hash for update;
  if link_row.id is null or link_row.status<>'active' or link_row.expires_at<=now() then return jsonb_build_object('state','unavailable'); end if;
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and (organization.industry='salon' or (organization.industry='pet_care' and organization.pet_care_pilot_enabled)) and organization.status='active' where appointment.id=link_row.appointment_id for update of appointment;
  if appointment_row.id is null or appointment_row.status not in('requested','confirmed') then return jsonb_build_object('state','unavailable'); end if;
  if p_action='confirm' then
    if appointment_row.status='requested' then
      update public.appointments set status='confirmed' where id=appointment_row.id;
      insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_confirmed',jsonb_build_object('link_id',link_row.id));
    end if;
    return jsonb_build_object('state','confirmed');
  end if;
  if p_starts_at is null or p_starts_at<now()+interval '1 hour' or p_starts_at>now()+interval '90 days' then raise exception 'Choose a valid future appointment time'; end if;
  if exists(
    select 1 from public.appointment_services item
    left join public.services service on service.id=item.service_id and service.organization_id=appointment_row.organization_id and service.is_active
    where item.appointment_id=appointment_row.id and (
      service.id is null or (
        exists(select 1 from public.service_branch_availability configured where configured.service_id=service.id)
        and not exists(select 1 from public.service_branch_availability available where available.service_id=service.id and available.branch_id=appointment_row.branch_id and available.is_available)
      )
    )
  ) then raise exception 'Appointment treatments are unavailable at this branch'; end if;
  select coalesce(sum(duration_minutes),0) into duration from public.appointment_services where appointment_id=appointment_row.id;
  if duration<=0 then raise exception 'Appointment treatments are unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(appointment_row.branch_id::text,0));
  select p_starts_at at time zone branch.timezone,
    branch.opening_hours->lower(trim(to_char(p_starts_at at time zone branch.timezone,'Day')))
    into local_start,hours from public.branches branch where branch.id=appointment_row.branch_id and branch.is_active;
  if hours is null or coalesce((hours->>'closed')::boolean,false) or hours->>'open' is null or hours->>'close' is null then raise exception 'The branch is closed at that time'; end if;
  open_time:=(hours->>'open')::time;close_time:=(hours->>'close')::time;
  if local_start::time<open_time or (requested_end at time zone (select timezone from public.branches where id=appointment_row.branch_id))::time>close_time
    or local_start::date<>(requested_end at time zone (select timezone from public.branches where id=appointment_row.branch_id))::date
  then raise exception 'The selected time is outside branch operating hours'; end if;
  if not (select appointment_parallel_enabled from public.organizations where id=appointment_row.organization_id) and exists(select 1 from public.appointments a where a.organization_id=appointment_row.organization_id and a.branch_id=appointment_row.branch_id and a.id<>appointment_row.id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at)
  then raise exception 'That time is no longer available'; end if;
  if exists(select 1 from public.appointment_staff_assignments mine join public.appointment_staff_assignments other on other.staff_profile_id=mine.staff_profile_id and other.appointment_id<>mine.appointment_id join public.appointments a on a.id=other.appointment_id where mine.appointment_id=appointment_row.id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at)
  then raise exception 'The assigned staff member is unavailable at that time'; end if;
  if exists(select 1 from public.appointment_resource_assignments mine join public.scheduling_resources resource on resource.id=mine.resource_id where mine.appointment_id=appointment_row.id and public.appointment_resource_peak(mine.resource_id,p_starts_at,requested_end,appointment_row.id)+mine.quantity>resource.capacity)
  then raise exception 'The assigned resource is unavailable at that time'; end if;
  update public.appointments set starts_at=p_starts_at where id=appointment_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_rescheduled',jsonb_build_object('link_id',link_row.id,'starts_at',p_starts_at));
  return jsonb_build_object('state','rescheduled');
end $function$
;

CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_amount_centavos bigint, p_method payment_method, p_idempotency_key text, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare appointment_row public.appointments; existing_payment public.payments; paid bigint; payment_id uuid; operation_key text:=nullif(trim(coalesce(p_idempotency_key,'')),''); normalized_reference text:=nullif(trim(coalesce(p_reference,'')),''); normalized_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and (organization.industry='salon' or (organization.industry='pet_care' and organization.pet_care_pilot_enabled)) and organization.status='active' where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  if operation_key is null or char_length(operation_key) not between 8 and 200 then raise exception 'Invalid idempotency key'; end if;
  select * into existing_payment from public.payments where organization_id=appointment_row.organization_id and appointment_idempotency_key=operation_key and appointment_id is not null;
  if existing_payment.id is not null then
    if existing_payment.appointment_id=appointment_row.id and existing_payment.amount_centavos=p_amount_centavos and existing_payment.method=p_method
      and existing_payment.reference is not distinct from normalized_reference and existing_payment.notes is not distinct from normalized_notes
    then return existing_payment.id; end if;
    raise exception 'Idempotency key conflicts with an existing payment';
  end if;
  select coalesce(sum(amount_centavos),0) into paid from public.payments where appointment_id=appointment_row.id and status='paid';
  if p_amount_centavos<=0 or p_amount_centavos>appointment_row.expected_total_centavos-paid then raise exception 'Invalid payment amount'; end if;
  insert into public.payments(organization_id,branch_id,appointment_id,amount_centavos,method,status,reference,paid_at,notes,received_by,created_by,appointment_idempotency_key)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_amount_centavos,p_method,'paid',normalized_reference,now(),normalized_notes,auth.uid(),auth.uid(),operation_key)
  returning id into payment_id;
  return payment_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.validate_appointment_self_service_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists(select 1 from public.appointments a join public.organizations o on o.id=a.organization_id and (o.industry='salon' or (o.industry='pet_care' and o.pet_care_pilot_enabled)) and o.status='active'
    where a.id=new.appointment_id and a.organization_id=new.organization_id and a.branch_id=new.branch_id)
  then raise exception 'Appointment self-service tenant mismatch'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_public_appointment_self_service(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select case when link.status<>'active' then jsonb_build_object('state',link.status)
    when link.expires_at<=now() then jsonb_build_object('state','expired')
    when appointment.status in('cancelled','no_show') then jsonb_build_object('state','unavailable')
    else jsonb_build_object(
      'state','active','scheduleRevision',link.schedule_revision,'petName',(select pet_name_snapshot from public.pet_appointment_details where appointment_id=appointment.id),'businessName',organization.name,'logoUrl',organization.logo_url,'branchName',branch.name,'branchTimezone',branch.timezone,
      'appointmentStatus',appointment.status,'startsAt',appointment.starts_at,'endsAt',appointment.ends_at,
      'treatments',(select coalesce(jsonb_agg(jsonb_build_object('name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=appointment.id),
      'assignedStaff',(select coalesce(jsonb_agg(case when organization.industry='salon' then coalesce(profile.full_name,staff.full_name) else staff.full_name end order by staff.full_name),'[]'::jsonb) from public.appointment_staff_assignments assignment join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id and staff.organization_id=appointment.organization_id left join public.organization_memberships member on member.id=staff.membership_id and member.organization_id=appointment.organization_id left join public.profiles profile on profile.id=member.user_id where assignment.appointment_id=appointment.id),
      'paymentStatus',case when coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)>=appointment.expected_total_centavos then 'paid' when exists(select 1 from public.payments p where p.appointment_id=appointment.id and p.status='paid') then 'partial' else 'unpaid' end,
      'totalCentavos',appointment.expected_total_centavos,
      'paidCentavos',coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)
    ) end into result
  from public.appointment_self_service_links link
  join public.appointments appointment on appointment.id=link.appointment_id
  join public.organizations organization on organization.id=link.organization_id and (organization.industry='salon' or (organization.industry='pet_care' and organization.pet_care_pilot_enabled)) and organization.status='active'
  join public.branches branch on branch.id=link.branch_id
  where link.token_hash=p_token_hash;
  return coalesce(result,jsonb_build_object('state','invalid'));
end $function$
;

