-- Versioned public Pet writes; existing Salon signatures remain available.
CREATE OR REPLACE FUNCTION public.update_public_appointment_self_service(p_token_hash text, p_action text, p_starts_at timestamp with time zone, p_expected_revision integer)
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
  if exists(select 1 from public.organizations where id=appointment_row.organization_id and industry='pet_care') and (p_expected_revision is null or p_expected_revision<>link_row.schedule_revision) then return jsonb_build_object('state','unavailable'); end if;
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
revoke all on function public.update_public_appointment_self_service(text,text,timestamptz,integer) from public;
grant execute on function public.update_public_appointment_self_service(text,text,timestamptz,integer) to anon,authenticated;
create or replace function public.update_public_appointment_self_service(p_token_hash text,p_action text,p_starts_at timestamptz default null) returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.update_public_appointment_self_service(p_token_hash,p_action,p_starts_at,null) $$;

create function public.enqueue_pet_care_message(p_appointment_id uuid,p_kind text) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments; d public.pet_appointment_details; c public.customers; b public.branches; o public.organizations; l public.appointment_self_service_links; pref public.customer_communication_preferences; channel text; address text; reason text; generation text; payload jsonb; inserted integer; queued integer:=0;
begin
 select * into a from public.appointments where id=p_appointment_id;
 select * into d from public.pet_appointment_details where appointment_id=a.id;
 if d.appointment_id is null or not public.pet_care_enabled(a.organization_id) or not public.has_entitlement(a.organization_id,'reminders') then return 0; end if;
 if p_kind='ready' and (a.status<>'completed' or d.pickup_status<>'ready') then return 0; end if;
 if p_kind in('confirmation','reminder') and a.status not in('requested','confirmed') then return 0; end if;
 if p_kind not in('ready','confirmation','reminder') then return 0; end if;
 select * into c from public.customers where id=a.customer_id and organization_id=a.organization_id;
 select * into b from public.branches where id=a.branch_id;
 select * into o from public.organizations where id=a.organization_id;
 select * into l from public.appointment_self_service_links where appointment_id=a.id and status='active' and expires_at>now();
 select * into pref from public.customer_communication_preferences where customer_id=c.id and organization_id=a.organization_id;
 generation:=case when p_kind='ready' then d.ready_at::text else coalesce(l.id::text,'no-link')||':'||coalesce(l.schedule_revision::text,'0') end;
 payload:=jsonb_build_object('businessName',o.name,'branchName',b.name,'ownerFirstName',split_part(c.full_name,' ',1),'petName',d.pet_name_snapshot,'startsAt',a.starts_at,'timezone',b.timezone,'kind',p_kind,'scheduleRevision',l.schedule_revision,'services',(select coalesce(jsonb_agg(service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=a.id));
 foreach channel in array array['email','sms'] loop
  address:=case when channel='email' and trim(coalesce(c.email,'')) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then lower(trim(c.email)) when channel='sms' then public.normalize_ph_mobile(c.phone) end;
  reason:=case when address is null then 'CONTACT_UNAVAILABLE' when c.is_archived then 'CUSTOMER_ARCHIVED' when channel='email' and not coalesce(pref.email_opt_in,false) then 'EMAIL_OPTED_OUT' when channel='sms' and not coalesce(pref.sms_opt_in,false) then 'SMS_OPTED_OUT' when p_kind<>'ready' and l.delivery_secret_id is null then 'DELIVERY_SECRET_UNAVAILABLE' end;
  insert into public.notification_outbox(organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,template_key,template_version,payload,reference_type,reference_id,delivery_secret_id,deduplication_key,status,eligibility_reason,available_at,expires_at,cancelled_at)
  values(a.organization_id,a.branch_id,c.id,'PET_CARE_'||upper(p_kind),channel,address,'pet-care-'||p_kind||'-'||channel||'-v1',1,payload,'appointment',a.id,case when p_kind='ready' then null else l.delivery_secret_id end,'pet-care:'||a.id||':'||p_kind||':'||generation||':'||channel,case when reason is null then 'pending' else 'cancelled' end,reason,now(),case when p_kind='ready' then now()+interval '1 day' else least(l.expires_at,a.starts_at) end,case when reason is not null then now() end) on conflict(deduplication_key) do nothing;
 get diagnostics inserted = row_count;
 if reason is null then queued:=queued+inserted; end if;
 end loop;
 return queued;
end $$;
revoke all on function public.enqueue_pet_care_message(uuid,text) from public,anon,authenticated;
create function public.pet_care_message_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='pet_appointment_details' then
   if new.pickup_status='ready' and old.pickup_status<>'ready' then perform public.enqueue_pet_care_message(new.appointment_id,'ready'); end if;
   if new.pickup_status='collected' then update public.notification_outbox set status='cancelled',cancelled_at=now(),eligibility_reason='PET_COLLECTED',locked_by=null,locked_at=null where reference_id=new.appointment_id and notification_type='PET_CARE_READY' and status in('pending','processing'); end if;
 else perform public.enqueue_pet_care_message(new.appointment_id,'confirmation'); end if;
 return new;
end $$;
create trigger pet_ready_message after update of pickup_status on public.pet_appointment_details for each row execute function public.pet_care_message_trigger();
create trigger pet_confirmation_message after insert on public.appointment_self_service_links for each row execute function public.pet_care_message_trigger();
create function public.invalidate_pet_care_messages() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.starts_at is distinct from old.starts_at or new.status not in('requested','confirmed') then
 update public.notification_outbox set status='cancelled',cancelled_at=now(),eligibility_reason='APPOINTMENT_CHANGED',locked_by=null,locked_at=null where reference_id=new.id and notification_type in('PET_CARE_CONFIRMATION','PET_CARE_REMINDER') and status in('pending','processing'); end if;
 return new;
end $$;
create trigger pet_message_invalidation after update of starts_at,status on public.appointments for each row execute function public.invalidate_pet_care_messages();
create function public.enqueue_due_pet_care_reminders(p_limit integer default 100) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare a record; count integer:=0;
begin
 if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
 for a in select x.id from public.appointments x join public.pet_appointment_details d on d.appointment_id=x.id where x.status in('requested','confirmed') and x.starts_at>now() and x.starts_at<=now()+interval '24 hours' order by x.starts_at limit least(greatest(p_limit,1),500) loop count:=count+public.enqueue_pet_care_message(a.id,'reminder'); end loop;
 return count;
end $$;
revoke all on function public.enqueue_due_pet_care_reminders(integer) from public,anon,authenticated;
grant execute on function public.enqueue_due_pet_care_reminders(integer) to service_role;
create function public.pet_care_notification_is_current(p_outbox_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.notification_outbox n join public.appointments a on a.id=n.reference_id join public.pet_appointment_details d on d.appointment_id=a.id join public.customers c on c.id=a.customer_id where n.id=p_outbox_id and n.recipient_customer_id=a.customer_id and not c.is_archived and public.pet_care_enabled(a.organization_id) and public.has_entitlement(a.organization_id,'reminders') and case when n.notification_type='PET_CARE_READY' then a.status='completed' and d.pickup_status='ready' else a.status in('requested','confirmed') and a.starts_at>now() and a.starts_at=(n.payload->>'startsAt')::timestamptz and exists(select 1 from public.appointment_self_service_links l where l.appointment_id=a.id and l.status='active' and l.expires_at>now() and l.schedule_revision=(n.payload->>'scheduleRevision')::integer and l.delivery_secret_id=n.delivery_secret_id) end) $$;
revoke all on function public.pet_care_notification_is_current(uuid) from public,anon,authenticated;
grant execute on function public.pet_care_notification_is_current(uuid) to service_role;
