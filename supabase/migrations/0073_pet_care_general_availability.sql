-- Pet Care is a standard grooming vertical. Existing role, branch and plan boundaries remain authoritative.
-- Retain the legacy flag for older readers; it no longer controls feature access.
create or replace function public.pet_care_enabled(p_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.organizations where id=p_org and industry='pet_care' and status='active') $$;
comment on column public.organizations.pet_care_pilot_enabled is 'Deprecated; Pet Care access now follows industry, organization status, roles and entitlements.';

-- Clients cannot alter scheduling policy. Pet Care parallel scheduling is canonical configuration.
create or replace function public.guard_organization_pilot_configuration() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (current_user in('anon','authenticated') or (auth.uid() is not null and coalesce(auth.role(),'')<>'service_role')) and
   ((tg_op='INSERT' and (new.pet_care_pilot_enabled or new.appointment_parallel_enabled)) or
    (tg_op='UPDATE' and (new.pet_care_pilot_enabled is distinct from old.pet_care_pilot_enabled or new.appointment_parallel_enabled is distinct from old.appointment_parallel_enabled or new.industry is distinct from old.industry)))
 then raise exception 'Organization configuration requires trusted operations' using errcode='42501'; end if;
 if new.industry='pet_care' then new.appointment_parallel_enabled:=true; end if;
 return new;
end $$;
update public.organizations set appointment_parallel_enabled=true where industry='pet_care' and not appointment_parallel_enabled;

alter table public.organizations
  drop constraint organizations_business_type_check;

alter table public.organizations
  add constraint organizations_business_type_check check (
    business_type is null or business_type in (
      'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
      'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
      'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other',
      'salon', 'spa', 'facial_clinic', 'nail_salon', 'barber_shop',
      'other_beauty', 'pet_grooming', 'pet_spa'
    )
  );



create or replace function public.create_first_organization(
  p_name text,
  p_industry text,
  p_business_type text,
  p_slug_base text,
  p_legal_name text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_facebook_page text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(p_name);
  normalized_industry text := lower(trim(p_industry));
  normalized_type text := trim(p_business_type);
  normalized_slug text := lower(trim(p_slug_base));
  candidate_slug text;
  suffix integer := 1;
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Concurrent submissions for the same user serialize before membership is
  -- checked, so only one first organization can be created.
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1 from public.organization_memberships
    where user_id = current_user_id and is_active = true
  ) then
    raise exception 'User already belongs to an organization' using errcode = 'P0001';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'Invalid business name' using errcode = '22023';
  end if;
  if normalized_industry is null or normalized_industry not in ('automotive', 'salon', 'pet_care') then
    raise exception 'Invalid organization industry' using errcode = '22023';
  end if;
  if normalized_type is null or (normalized_industry = 'automotive' and normalized_type not in (
      'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
      'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
      'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other'
    )) or (normalized_industry = 'salon' and normalized_type not in (
      'salon', 'spa', 'facial_clinic', 'nail_salon', 'barber_shop', 'other_beauty'
    )) or (normalized_industry = 'pet_care' and normalized_type not in ('pet_grooming', 'pet_spa')) then
    raise exception 'Business type does not match organization industry' using errcode = '22023';
  end if;
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(normalized_slug) > 70 then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if char_length(coalesce(p_legal_name, '')) > 120
    or char_length(coalesce(p_phone, '')) > 30
    or char_length(coalesce(p_email, '')) > 254
    or char_length(coalesce(p_website, '')) > 500
    or char_length(coalesce(p_facebook_page, '')) > 500 then
    raise exception 'Invalid optional business details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('servicecore:organization-slug', 0));
  loop
    candidate_slug := case when suffix = 1 then normalized_slug else normalized_slug || '-' || suffix::text end;
    exit when not exists (select 1 from public.organizations where slug = candidate_slug);
    suffix := suffix + 1;
  end loop;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (
    name, industry, business_type, slug, legal_name, phone, email, website,
    facebook_page, currency, timezone, created_by
  ) values (
    normalized_name,
    normalized_industry,
    normalized_type,
    candidate_slug,
    nullif(trim(coalesce(p_legal_name, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_facebook_page, '')), ''),
    'PHP',
    'Asia/Manila',
    current_user_id
  ) returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner');

  insert into public.organization_subscriptions (organization_id, plan_id, status)
  values (new_organization_id, 'free', 'free');

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, event_type,
    metadata
  ) values (
    new_organization_id, current_user_id, 'organization',
    new_organization_id, 'organization.created',
    jsonb_build_object('industry', normalized_industry, 'business_type', normalized_type)
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_first_organization(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_first_organization(text, text, text, text, text, text, text, text, text) to authenticated;

comment on function public.create_first_organization(text, text, text, text, text, text, text, text, text) is
  'Creates the authenticated user first organization, owner membership, and subscription with a validated product industry.';

CREATE OR REPLACE FUNCTION public.create_appointment_self_service_link(p_appointment_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_secret_ciphertext text DEFAULT NULL::text, p_secret_initialization_vector text DEFAULT NULL::text, p_secret_authentication_tag text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare appointment_row public.appointments; link_id uuid; secret_id uuid; old_link record;
begin
  select appointment.* into appointment_row from public.appointments appointment
  join public.organizations organization on organization.id=appointment.organization_id and organization.industry in('salon','pet_care') and organization.status='active'
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

CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_amount_centavos bigint, p_method payment_method, p_idempotency_key text, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare appointment_row public.appointments; existing_payment public.payments; paid bigint; payment_id uuid; operation_key text:=nullif(trim(coalesce(p_idempotency_key,'')),''); normalized_reference text:=nullif(trim(coalesce(p_reference,'')),''); normalized_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry in('salon','pet_care') and organization.status='active' where appointment.id=p_appointment_id for update of appointment;
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
  if not exists(select 1 from public.appointments a join public.organizations o on o.id=a.organization_id and o.industry in('salon','pet_care') and o.status='active'
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
  join public.organizations organization on organization.id=link.organization_id and organization.industry in('salon','pet_care') and organization.status='active'
  join public.branches branch on branch.id=link.branch_id
  where link.token_hash=p_token_hash;
  return coalesce(result,jsonb_build_object('state','invalid'));
end $function$
;

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
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry in('salon','pet_care') and organization.status='active' where appointment.id=link_row.appointment_id for update of appointment;
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

