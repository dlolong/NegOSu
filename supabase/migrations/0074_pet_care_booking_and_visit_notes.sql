-- Core booking subject discriminator prevents unrelated pets being treated as duplicate requests.
alter table public.public_booking_requests add column subject_key text check(char_length(subject_key)<=250);
create or replace function public.submit_public_booking_request(
 p_slug text,p_branch_id uuid,p_service_ids uuid[],p_preferred_at timestamptz,p_customer_name text,p_phone text,p_email text,
 p_vehicle_make text,p_vehicle_model text,p_vehicle_year integer,p_vehicle_type text,p_plate_number text,p_customer_note text,p_rate_key_hash text,p_honeypot text default '', p_subject_key text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 org_id uuid; org_industry text; request_id uuid; token text:=encode(extensions.gen_random_bytes(32),'hex'); reference text;
 normalized_phone text; normalized_email text; normalized_plate text; dup text;
 window_time timestamptz:=date_trunc('hour',now())+(floor(extract(minute from now())/15)*interval '15 minutes');
 current_count integer; service_id uuid; sorted_services uuid[]; duration integer;
begin
  if char_length(coalesce(p_subject_key,''))>250 then raise exception 'Invalid booking subject'; end if;
  if coalesce(p_honeypot,'')<>'' then raise exception 'Unable to submit booking'; end if;
  if p_preferred_at is null or p_preferred_at<=now()+interval '1 hour' or p_preferred_at>now()+interval '60 days' then raise exception 'Invalid booking request'; end if;
  normalized_phone:=public.normalize_phone(p_phone);
  normalized_email:=nullif(lower(trim(coalesce(p_email,''))),'');
  if char_length(trim(coalesce(p_customer_name,''))) not between 2 and 120
    or char_length(trim(coalesce(p_phone,''))) not between 7 and 30 or normalized_phone!~'^\+?[0-9]{7,15}$'
    or char_length(coalesce(p_email,''))>254 or (normalized_email is not null and normalized_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or char_length(coalesce(p_customer_note,''))>1000 or char_length(coalesce(p_rate_key_hash,'')) not between 1 and 128 then raise exception 'Invalid booking details'; end if;
  select o.id,o.industry into org_id,org_industry from public.organizations o where o.slug=lower(trim(p_slug)) and o.public_page_enabled and o.status='active' for share;
  if org_id is null then raise exception 'Shop unavailable'; end if;
  -- The canonical scheduling lock serializes confirmation with internal edits.
  -- Requests do not reserve capacity; confirmation rechecks it under this lock.
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  perform 1 from public.branches b where b.id=p_branch_id and b.organization_id=org_id for share;
  perform 1 from public.services s where s.id=any(p_service_ids) and s.organization_id=org_id order by s.id for share;
  duration:=public.public_booking_service_duration(org_id,p_branch_id,p_service_ids);
  if org_industry='automotive' then
    if char_length(trim(coalesce(p_vehicle_make,''))) not between 1 and 80 or char_length(trim(coalesce(p_vehicle_model,''))) not between 1 and 80
      or (p_vehicle_year is not null and p_vehicle_year not between 1900 and 2200)
      or char_length(coalesce(p_vehicle_type,''))>80 or char_length(coalesce(p_plate_number,''))>30 then raise exception 'Invalid booking details'; end if;
  else
    -- Salon never writes a vehicle, even if an old or tampered client sends one.
    p_vehicle_make:=null;p_vehicle_model:=null;p_vehicle_year:=null;p_vehicle_type:=null;p_plate_number:=null;
  end if;
  if not public.public_booking_slot_is_available(org_id,p_branch_id,p_preferred_at,duration,true) then raise exception 'Selected booking time is unavailable'; end if;
  insert into public.public_booking_rate_limits(key_hash,window_started_at,request_count) values(p_rate_key_hash,window_time,1)
    on conflict(key_hash,window_started_at) do update set request_count=public.public_booking_rate_limits.request_count+1 returning request_count into current_count;
  if current_count>5 then raise exception 'Too many booking requests'; end if;
  select array_agg(value order by value) into sorted_services from unnest(p_service_ids) value;
  -- Existing pending requests retain their historical hash. Compare the actual
  -- request identity as well, without rewriting data or weakening uniqueness.
  if exists(select 1 from public.public_booking_requests r
    where r.organization_id=org_id and r.branch_id=p_branch_id and r.status='requested'
      and public.normalize_phone(r.phone)=normalized_phone and r.email_normalized is not distinct from normalized_email
      and r.preferred_at=p_preferred_at and r.subject_key is not distinct from p_subject_key
      and (select array_agg(s.service_id order by s.service_id) from public.public_booking_services s where s.booking_request_id=r.id)=sorted_services
  ) then raise exception 'A similar booking request is already pending'; end if;
  normalized_plate:=nullif(upper(regexp_replace(coalesce(p_plate_number,''),'[^A-Za-z0-9]','','g')),'');
  dup:=encode(extensions.digest(org_id::text||p_branch_id::text||normalized_phone||coalesce(normalized_email,'')||extract(epoch from p_preferred_at)::text||array_to_string(sorted_services,',')||coalesce(p_subject_key,''),'sha256'),'hex');
  reference:='BK-'||upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
  insert into public.public_booking_requests(organization_id,branch_id,public_reference,confirmation_token_hash,customer_name,phone,phone_normalized,email,email_normalized,vehicle_make,vehicle_model,vehicle_year,vehicle_type,plate_number,plate_normalized,preferred_at,customer_note,duplicate_hash,rate_key_hash,subject_key)
    values(org_id,p_branch_id,reference,encode(extensions.digest(token,'sha256'),'hex'),trim(p_customer_name),trim(p_phone),normalized_phone,normalized_email,normalized_email,trim(p_vehicle_make),trim(p_vehicle_model),p_vehicle_year,nullif(trim(coalesce(p_vehicle_type,'')),''),nullif(trim(coalesce(p_plate_number,'')),''),normalized_plate,p_preferred_at,nullif(trim(coalesce(p_customer_note,'')),''),dup,p_rate_key_hash,p_subject_key) returning id into request_id;
  foreach service_id in array sorted_services loop
    insert into public.public_booking_services(booking_request_id,service_id,service_name_snapshot,price_centavos,duration_minutes)
      select request_id,s.id,s.name,public.resolve_service_price(s.id,p_branch_id,case when org_industry='automotive' then lower(replace(coalesce(p_vehicle_type,'custom'),' ','_')) end),s.duration_minutes from public.services s where s.id=service_id;
  end loop;
  return jsonb_build_object('reference',reference,'token',token);
exception when unique_violation then raise exception 'A similar booking request is already pending';
end $$;


revoke all on function public.submit_public_booking_request(text,uuid,uuid[],timestamptz,text,text,text,text,text,integer,text,text,text,text,text,text) from public,anon,authenticated;
-- Keep the existing public contract; vertical adapters alone supply subject identity.
create or replace function public.submit_public_booking(
 p_slug text,p_branch_id uuid,p_service_ids uuid[],p_preferred_at timestamptz,p_customer_name text,p_phone text,p_email text,
 p_vehicle_make text,p_vehicle_model text,p_vehicle_year integer,p_vehicle_type text,p_plate_number text,p_customer_note text,p_rate_key_hash text,p_honeypot text default ''
) returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select public.submit_public_booking_request(p_slug,p_branch_id,p_service_ids,p_preferred_at,p_customer_name,p_phone,p_email,p_vehicle_make,p_vehicle_model,p_vehicle_year,p_vehicle_type,p_plate_number,p_customer_note,p_rate_key_hash,p_honeypot,null)
$$;

-- Vertical extensions to Core public requests and appointments. No public profile reads.
create table public.pet_booking_details (
 booking_request_id uuid primary key references public.public_booking_requests(id) on delete cascade,
 pet_name text not null check(char_length(trim(pet_name)) between 1 and 120),
 species text not null check(species in('dog','cat','other')),
 breed text check(char_length(breed)<=120)
);
alter table public.pet_booking_details enable row level security;
create policy pet_booking_read on public.pet_booking_details for select to authenticated using (
 exists(select 1 from public.public_booking_requests r where r.id=booking_request_id and public.can_access_branch(r.organization_id,r.branch_id))
);
revoke all on public.pet_booking_details from anon,authenticated;
grant select on public.pet_booking_details to authenticated;
grant all on public.pet_booking_details to service_role;

create function public.require_pet_booking_details() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.organizations where id=new.organization_id and industry='pet_care') and not exists(select 1 from public.pet_booking_details where booking_request_id=new.id)
 then raise exception 'Pet details are required for grooming requests'; end if;
 return null;
end $$;
create constraint trigger pet_booking_details_required after insert on public.public_booking_requests deferrable initially deferred for each row execute function public.require_pet_booking_details();
revoke all on function public.require_pet_booking_details() from public,anon,authenticated;

create function public.submit_pet_public_booking(
 p_slug text,p_branch_id uuid,p_service_ids uuid[],p_preferred_at timestamptz,p_customer_name text,p_phone text,p_email text,
 p_pet_name text,p_species text,p_breed text,p_customer_note text,p_rate_key_hash text,p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; request_id uuid;
begin
 if not exists(select 1 from public.organizations where slug=lower(trim(p_slug)) and industry='pet_care' and status='active' and public_page_enabled)
 then raise exception 'Shop unavailable'; end if;
 if char_length(trim(coalesce(p_pet_name,''))) not between 1 and 120 or p_species is null or p_species not in('dog','cat','other') or char_length(coalesce(p_breed,''))>120
 then raise exception 'Invalid pet details'; end if;
 -- Reuse Core service validation, rate limits, duplicate prevention and price snapshots.
 result:=public.submit_public_booking_request(p_slug,p_branch_id,p_service_ids,p_preferred_at,p_customer_name,p_phone,p_email,null,null,null,null,null,p_customer_note,p_rate_key_hash,p_honeypot,lower(trim(p_pet_name))||':'||p_species);
 select id into request_id from public.public_booking_requests where confirmation_token_hash=encode(extensions.digest(result->>'token','sha256'),'hex');
 insert into public.pet_booking_details(booking_request_id,pet_name,species,breed) values(request_id,trim(p_pet_name),p_species,nullif(trim(p_breed),''));
 return result;
end $$;
revoke all on function public.submit_pet_public_booking(text,uuid,uuid[],timestamptz,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_pet_public_booking(text,uuid,uuid[],timestamptz,text,text,text,text,text,text,text,text,text) to anon,authenticated;

create function public.confirm_pet_public_booking(p_booking_id uuid,p_pet_id uuid,p_staff_id uuid,p_resource_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; d public.pet_booking_details; pet public.pet_profiles; owner_id uuid; saved uuid; service_ids uuid[];
begin
 select * into r from public.public_booking_requests where id=p_booking_id for update;
 if r.id is null or not public.pet_care_enabled(r.organization_id) or not public.has_permission(r.organization_id,'appointments.manage') or not public.can_access_branch(r.organization_id,r.branch_id)
 then raise exception 'Booking request not found' using errcode='42501'; end if;
 if r.status='confirmed' then return r.appointment_id; end if;
 if r.status<>'requested' then raise exception 'Request is no longer pending'; end if;
 select * into d from public.pet_booking_details where booking_request_id=r.id;
 if d.booking_request_id is null then raise exception 'Pet details unavailable'; end if;
 if p_pet_id is null then
   -- Never merge anonymous intake into a private customer using a name alone.
   insert into public.customers(organization_id,full_name,phone,phone_normalized,email,created_by)
   values(r.organization_id,r.customer_name,r.phone,r.phone_normalized,r.email_normalized,auth.uid()) returning id into owner_id;
   insert into public.pet_profiles(organization_id,customer_id,name,species,breed)
   values(r.organization_id,owner_id,d.pet_name,d.species,d.breed) returning * into pet;
 else
   select * into pet from public.pet_profiles where id=p_pet_id and organization_id=r.organization_id for update;
   if pet.id is null or not pet.is_active or lower(trim(pet.name))<>lower(trim(d.pet_name)) or pet.species<>d.species or not exists(
     select 1 from public.customers c where c.id=pet.customer_id and c.organization_id=r.organization_id and not c.is_archived
     and (c.phone_normalized=public.normalize_phone(r.phone) or (r.email_normalized is not null and lower(c.email)=r.email_normalized))
   ) then raise exception 'Selected pet does not match this owner request'; end if;
 end if;
 select array_agg(service_id order by service_id) into service_ids from public.public_booking_services where booking_request_id=r.id;
 perform public.public_booking_service_duration(r.organization_id,r.branch_id,service_ids);
 saved:=public.save_pet_appointment(pet.id,null,r.branch_id,service_ids,r.preferred_at,array[p_staff_id],array[p_resource_id],r.customer_note,null);
 update public.appointments set status='confirmed',source='public_booking' where id=saved;
 update public.public_booking_requests set status='confirmed',appointment_id=saved,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 return saved;
end $$;
revoke all on function public.confirm_pet_public_booking(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.confirm_pet_public_booking(uuid,uuid,uuid,uuid) to authenticated;

-- Append-only grooming observations. The client supplies a request ID, never authorship/scope.
create table public.pet_grooming_notes (
 id uuid primary key, appointment_id uuid not null references public.pet_appointment_details(appointment_id),
 organization_id uuid not null references public.organizations(id), branch_id uuid not null references public.branches(id),
 note text not null check(char_length(trim(note)) between 1 and 3000), next_visit_on date,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index pet_grooming_notes_visit_idx on public.pet_grooming_notes(appointment_id,created_at desc);
alter table public.pet_grooming_notes enable row level security;
create policy pet_grooming_notes_read on public.pet_grooming_notes for select to authenticated using(
 public.can_access_branch(organization_id,branch_id) and public.has_org_role(organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
);
revoke all on public.pet_grooming_notes from anon,authenticated;
grant select on public.pet_grooming_notes to authenticated;
grant all on public.pet_grooming_notes to service_role;
create function public.add_pet_grooming_note(p_id uuid,p_appointment_id uuid,p_note text,p_next_visit_on date default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments; existing public.pet_grooming_notes;
begin
 select * into a from public.appointments where id=p_appointment_id for update;
 if a.id is null or not public.pet_care_enabled(a.organization_id) or not public.has_org_role(a.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(a.organization_id,a.branch_id)
 then raise exception 'Grooming note access denied' using errcode='42501'; end if;
 if p_id is null or char_length(trim(coalesce(p_note,''))) not between 1 and 3000 then raise exception 'Enter a grooming note'; end if;
 select * into existing from public.pet_grooming_notes where id=p_id;
 if found then
   if existing.appointment_id<>a.id or existing.created_by<>auth.uid() or existing.note<>trim(p_note) or existing.next_visit_on is distinct from p_next_visit_on then raise exception 'Note request was already used'; end if;
   return existing.id;
 end if;
 if p_next_visit_on is not null and p_next_visit_on<(select (now() at time zone timezone)::date from public.branches where id=a.branch_id) then raise exception 'Next visit date cannot be in the past'; end if;
 if a.status not in('checked_in','in_service','completed') then raise exception 'Check in the pet before recording a grooming note'; end if;
 insert into public.pet_grooming_notes(id,appointment_id,organization_id,branch_id,note,next_visit_on,created_by)
 values(p_id,a.id,a.organization_id,a.branch_id,trim(p_note),p_next_visit_on,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
 values(a.organization_id,auth.uid(),'appointment',a.id,'pet_care.grooming_note_added',jsonb_build_object('note_id',p_id));
 return p_id;
end $$;
revoke all on function public.add_pet_grooming_note(uuid,uuid,text,date) from public,anon;
grant execute on function public.add_pet_grooming_note(uuid,uuid,text,date) to authenticated;

create or replace function public.public_booking_slot_is_available(p_organization_id uuid,p_branch_id uuid,p_starts_at timestamptz,p_duration integer,p_require_grid boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare hours jsonb; tz text; day_hours jsonb; day date; opens_at timestamptz; closes_at timestamptz; requested_end timestamptz;
begin
  if p_starts_at is null or p_starts_at<=now() or p_duration is null or p_duration<=0 then return false; end if;
  select b.opening_hours,b.timezone into hours,tz from public.branches b
    where b.organization_id=p_organization_id and b.id=p_branch_id and b.is_active and b.accepts_public_bookings;
  if not found or jsonb_typeof(hours)<>'object' then return false; end if;
  day:=(p_starts_at at time zone tz)::date;
  day_hours:=hours->lower(to_char(day,'FMDay'));
  if (day_hours is not null and jsonb_typeof(day_hours)<>'object') or (day_hours ? 'closed' and jsonb_typeof(day_hours->'closed')<>'boolean') then return false; end if;
  if coalesce(day_hours->'closed','false'::jsonb)='true'::jsonb then return false; end if;
  opens_at:=(day+coalesce((day_hours->>'open')::time,'08:00'::time)) at time zone tz;
  closes_at:=(day+coalesce((day_hours->>'close')::time,'17:00'::time)) at time zone tz;
  requested_end:=p_starts_at+make_interval(mins=>p_duration);
  return p_starts_at>=opens_at and requested_end<=closes_at
    and (not p_require_grid or mod(extract(epoch from p_starts_at-opens_at),1800)=0) and (case when public.pet_care_enabled(p_organization_id) then
    day_hours is not null and day_hours->>'open' is not null and day_hours->>'close' is not null
    and exists(select 1 from public.organization_staff_profiles s where s.organization_id=p_organization_id and s.is_active
      and (not exists(select 1 from public.staff_profile_branch_assignments x where x.staff_profile_id=s.id) or exists(select 1 from public.staff_profile_branch_assignments x where x.staff_profile_id=s.id and x.branch_id=p_branch_id))
      and not exists(select 1 from public.appointment_staff_assignments x join public.appointments a on a.id=x.appointment_id where x.staff_profile_id=s.id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at))
    and exists(select 1 from public.scheduling_resources resource where resource.organization_id=p_organization_id and resource.branch_id=p_branch_id and resource.is_active
      and public.appointment_resource_peak(resource.id,p_starts_at,requested_end,null)<resource.capacity)
    else not exists(
    select 1 from public.appointments a where a.organization_id=p_organization_id and a.branch_id=p_branch_id
      and a.status in('requested','confirmed','checked_in','in_service','queued')
      and a.starts_at<requested_end and coalesce(a.ends_at,a.starts_at+interval '1 hour')>p_starts_at
  ) end);
exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then return false;
end $$;


create function public.validate_pet_grooming_note_scope() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.appointments a join public.pet_appointment_details d on d.appointment_id=a.id where a.id=new.appointment_id and a.organization_id=new.organization_id and a.branch_id=new.branch_id)
 then raise exception 'Grooming note scope mismatch' using errcode='23514'; end if;
 return new;
end $$;
create trigger pet_grooming_note_scope before insert or update on public.pet_grooming_notes for each row execute function public.validate_pet_grooming_note_scope();
revoke all on function public.validate_pet_grooming_note_scope() from public,anon,authenticated;

create or replace function public.guard_pet_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.pet_care_enabled(new.organization_id) or not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id and not is_archived) then raise exception 'Pet owner is unavailable' using errcode='23514'; end if;
 if new.date_of_birth>current_date then raise exception 'Birth date cannot be in the future'; end if;
 if tg_op='UPDATE' then
   if old.is_active and not new.is_active and exists(select 1 from public.pet_appointment_details d join public.appointments a on a.id=d.appointment_id where d.pet_id=old.id and a.status in('requested','confirmed','checked_in','in_service')) then raise exception 'Finish or cancel active grooming appointments before deactivating the pet'; end if;
   if new.organization_id<>old.organization_id then raise exception 'Pet organization cannot change'; end if;
   if new.customer_id<>old.customer_id then
     if exists(select 1 from public.pet_appointment_details d join public.appointments a on a.id=d.appointment_id where d.pet_id=old.id and a.status in('requested','confirmed','checked_in','in_service')) then raise exception 'Finish or cancel active grooming appointments before changing the pet owner'; end if;
     update public.appointment_self_service_links set status='revoked',revoked_at=now() where appointment_id in(select appointment_id from public.pet_appointment_details where pet_id=old.id) and status='active';
   end if;
 end if;
 new.updated_at:=now(); return new;
end $$;

create function public.guard_pet_owner_archive() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.is_archived and not old.is_archived then
   perform 1 from public.pet_profiles where customer_id=old.id order by id for update;
   if exists(select 1 from public.pet_appointment_details d join public.appointments a on a.id=d.appointment_id where a.customer_id=old.id and a.status in('requested','confirmed','checked_in','in_service'))
   then raise exception 'Finish or cancel active grooming visits before archiving this owner'; end if;
 end if;
 return new;
end $$;
create trigger pet_owner_archive_guard before update of is_archived on public.customers for each row execute function public.guard_pet_owner_archive();
revoke all on function public.guard_pet_owner_archive() from public,anon,authenticated;
