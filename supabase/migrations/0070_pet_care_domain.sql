-- Invitation-only third vertical. No existing organization is converted or opted in.
alter table public.organizations drop constraint organizations_industry_check;
alter table public.organizations add constraint organizations_industry_check check(industry in('automotive','salon','pet_care'));
alter table public.organizations add column pet_care_pilot_enabled boolean not null default false;
alter table public.organizations add column appointment_parallel_enabled boolean not null default false;
-- The following migration guards privileged configuration, including legacy table-level grants.
comment on column public.organizations.pet_care_pilot_enabled is 'Trusted organization pilot opt-in; independent of roles and subscription entitlements.';

create function public.pet_care_enabled(p_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.organizations where id=p_org and industry='pet_care' and pet_care_pilot_enabled and status='active') $$;
revoke all on function public.pet_care_enabled(uuid) from public,anon;
grant execute on function public.pet_care_enabled(uuid) to authenticated,service_role;

create table public.pet_profiles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 customer_id uuid not null references public.customers(id), name text not null check(char_length(trim(name)) between 1 and 120),
 species text not null check(species in('dog','cat','other')), breed text check(char_length(breed)<=120),
 date_of_birth date, size_category text check(size_category in('small','medium','large','extra_large')),
 coat text check(char_length(coat)<=300), grooming_preferences text check(char_length(grooming_preferences)<=1000),
 handling_cautions text check(char_length(handling_cautions)<=1000), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id)
);
create table public.pet_appointment_details (
 appointment_id uuid primary key references public.appointments(id) on delete restrict,
 organization_id uuid not null references public.organizations(id), pet_id uuid not null,
 customer_id_snapshot uuid not null references public.customers(id), pet_name_snapshot text not null,
 pickup_status text not null default 'not_ready' check(pickup_status in('not_ready','ready','collected')),
 ready_at timestamptz, collected_at timestamptz, collected_by uuid references auth.users(id),
 foreign key(pet_id,organization_id) references public.pet_profiles(id,organization_id)
);
create index pet_profiles_customer_idx on public.pet_profiles(organization_id,customer_id);
create index pet_appointments_pet_idx on public.pet_appointment_details(pet_id,appointment_id);
alter table public.pet_profiles enable row level security;
alter table public.pet_appointment_details enable row level security;
create policy pet_profiles_read on public.pet_profiles for select to authenticated using(public.is_org_member(organization_id));
create policy pet_profiles_write on public.pet_profiles for all to authenticated using(public.pet_care_enabled(organization_id) and public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])) with check(public.pet_care_enabled(organization_id) and public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]));
create policy pet_appointments_read on public.pet_appointment_details for select to authenticated using(exists(select 1 from public.appointments a where a.id=appointment_id and a.organization_id=pet_appointment_details.organization_id and public.can_access_branch(a.organization_id,a.branch_id)));
revoke all on public.pet_profiles,public.pet_appointment_details from anon,authenticated;
grant select,insert on public.pet_profiles to authenticated;
grant update(customer_id,name,species,breed,date_of_birth,size_category,coat,grooming_preferences,handling_cautions,is_active) on public.pet_profiles to authenticated;
grant select on public.pet_appointment_details to authenticated;
grant all on public.pet_profiles,public.pet_appointment_details to service_role;

create function public.guard_pet_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.pet_care_enabled(new.organization_id) or not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id and not is_archived) then raise exception 'Pet owner is unavailable' using errcode='23514'; end if;
 if new.date_of_birth>current_date then raise exception 'Birth date cannot be in the future'; end if;
 if tg_op='UPDATE' then
   if new.organization_id<>old.organization_id then raise exception 'Pet organization cannot change'; end if;
   if new.customer_id<>old.customer_id then
     if exists(select 1 from public.pet_appointment_details d join public.appointments a on a.id=d.appointment_id where d.pet_id=old.id and a.status in('requested','confirmed','checked_in','in_service')) then raise exception 'Finish or cancel active grooming appointments before changing the pet owner'; end if;
     update public.appointment_self_service_links set status='revoked',revoked_at=now() where appointment_id in(select appointment_id from public.pet_appointment_details where pet_id=old.id) and status='active';
   end if;
 end if;
 new.updated_at:=now(); return new;
end $$;
create trigger pet_profile_guard before insert or update on public.pet_profiles for each row execute function public.guard_pet_profile();

-- Peak quantity within the candidate interval, not the sum of all intersecting rows.
create function public.appointment_resource_peak(p_resource uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid default null) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 with occupancy as(select greatest(a.starts_at,p_start) s,least(a.ends_at,p_end) e,x.quantity q from public.appointment_resource_assignments x join public.appointments a on a.id=x.appointment_id where x.resource_id=p_resource and a.id is distinct from p_exclude and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<p_end and a.ends_at>p_start), changes as(select s t,q delta from occupancy union all select e,-q from occupancy), grouped as(select t,sum(delta) delta from changes group by t), running as(select sum(delta) over(order by t) used from grouped) select coalesce(max(used),0)::bigint from running $$;
revoke all on function public.appointment_resource_peak(uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;

create function public.assert_pet_appointment(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments; d public.pet_appointment_details; p public.pet_profiles; r record; hours jsonb; tz text; local_start timestamp; local_end timestamp;
begin
 select * into a from public.appointments where id=p_id;
 if not exists(select 1 from public.organizations where id=a.organization_id and industry='pet_care') then return; end if;
 select * into d from public.pet_appointment_details where appointment_id=p_id;
 if d.appointment_id is null then raise exception 'A grooming appointment requires one pet' using errcode='23514'; end if;
 select * into p from public.pet_profiles where id=d.pet_id for update;
 if a.status not in('requested','confirmed','checked_in','in_service','completed','cancelled','no_show') then raise exception 'Unsupported grooming state'; end if;
 if d.organization_id<>a.organization_id or p.organization_id<>a.organization_id or d.customer_id_snapshot<>a.customer_id or a.vehicle_id is not null then raise exception 'Pet appointment ownership mismatch' using errcode='23514'; end if;
 if a.status in('requested','confirmed','checked_in','in_service') then
   perform 1 from public.organization_staff_profiles where id in(select staff_profile_id from public.appointment_staff_assignments where appointment_id=a.id) order by id for update;
   perform 1 from public.scheduling_resources where id in(select resource_id from public.appointment_resource_assignments where appointment_id=a.id) order by id for update;
   select timezone,opening_hours->lower(trim(to_char(a.starts_at at time zone timezone,'Day'))) into tz,hours from public.branches where id=a.branch_id and organization_id=a.organization_id and is_active;
   local_start:=a.starts_at at time zone tz;local_end:=a.ends_at at time zone tz;
   if tz is null or a.ends_at is null or hours is null or coalesce((hours->>'closed')::boolean,false) or hours->>'open' is null or hours->>'close' is null or local_start::date<>local_end::date or local_start::time<(hours->>'open')::time or local_end::time>(hours->>'close')::time then raise exception 'Grooming appointment is outside branch hours'; end if;
   if exists(select 1 from public.appointment_services item join public.services service on service.id=item.service_id where item.appointment_id=a.id and (not service.is_active or service.organization_id<>a.organization_id or (exists(select 1 from public.service_branch_availability x where x.service_id=service.id) and not exists(select 1 from public.service_branch_availability x where x.service_id=service.id and x.branch_id=a.branch_id and x.is_available)))) then raise exception 'Grooming service is unavailable'; end if;

   if not public.pet_care_enabled(a.organization_id) or not p.is_active or p.customer_id<>a.customer_id then raise exception 'Pet is unavailable'; end if;
   if exists(select 1 from public.pet_appointment_details other join public.appointments b on b.id=other.appointment_id where other.pet_id=p.id and b.id<>a.id and b.status in('requested','confirmed','checked_in','in_service') and b.starts_at<a.ends_at and b.ends_at>a.starts_at) then raise exception 'This pet already has a grooming appointment at that time' using errcode='23P01'; end if;
   if not exists(select 1 from public.customers where id=a.customer_id and organization_id=a.organization_id and not is_archived) then raise exception 'Pet owner is unavailable'; end if;
   if exists(select 1 from public.appointment_staff_assignments x join public.organization_staff_profiles staff on staff.id=x.staff_profile_id where x.appointment_id=a.id and (not staff.is_active or staff.organization_id<>a.organization_id or (exists(select 1 from public.staff_profile_branch_assignments b where b.staff_profile_id=staff.id) and not exists(select 1 from public.staff_profile_branch_assignments b where b.staff_profile_id=staff.id and b.branch_id=a.branch_id)))) then raise exception 'Assigned groomer is unavailable at this branch'; end if;
   if exists(select 1 from public.appointment_resource_assignments x join public.scheduling_resources resource on resource.id=x.resource_id where x.appointment_id=a.id and (not resource.is_active or resource.organization_id<>a.organization_id or resource.branch_id<>a.branch_id)) then raise exception 'Assigned resource is unavailable at this branch'; end if;
   if not exists(select 1 from public.appointment_staff_assignments where appointment_id=a.id) or not exists(select 1 from public.appointment_resource_assignments where appointment_id=a.id) then raise exception 'Assign a groomer and grooming resource'; end if;
   if exists(select 1 from public.appointment_staff_assignments mine join public.appointment_staff_assignments other on other.staff_profile_id=mine.staff_profile_id and other.appointment_id<>a.id join public.appointments b on b.id=other.appointment_id where mine.appointment_id=a.id and b.status in('requested','confirmed','checked_in','in_service','queued') and b.starts_at<a.ends_at and b.ends_at>a.starts_at) then raise exception 'The assigned groomer is busy'; end if;
   for r in select x.resource_id,x.quantity,s.capacity from public.appointment_resource_assignments x join public.scheduling_resources s on s.id=x.resource_id where x.appointment_id=a.id loop
     if public.appointment_resource_peak(r.resource_id,a.starts_at,a.ends_at,a.id)+r.quantity>r.capacity then raise exception 'Grooming resource capacity exceeded'; end if;
   end loop;
 end if;
end $$;
revoke all on function public.assert_pet_appointment(uuid) from public,anon,authenticated;
create function public.check_pet_appointment_integrity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='appointments' then perform public.assert_pet_appointment(new.id);
 else
   if tg_op<>'DELETE' then perform public.assert_pet_appointment(new.appointment_id); end if;
   if tg_op<>'INSERT' then perform public.assert_pet_appointment(old.appointment_id); end if;
 end if;
 return null;
end $$;
create constraint trigger pet_appointment_required after insert or update on public.appointments deferrable initially deferred for each row execute function public.check_pet_appointment_integrity();
create constraint trigger pet_appointment_scope after insert or update on public.pet_appointment_details deferrable initially deferred for each row execute function public.check_pet_appointment_integrity();

create constraint trigger pet_staff_required after insert or update or delete on public.appointment_staff_assignments deferrable initially deferred for each row execute function public.check_pet_appointment_integrity();
create constraint trigger pet_resource_required after insert or update or delete on public.appointment_resource_assignments deferrable initially deferred for each row execute function public.check_pet_appointment_integrity();

create function public.save_pet_appointment(p_pet_id uuid,p_appointment_id uuid,p_branch_id uuid,p_service_ids uuid[],p_starts_at timestamptz,p_staff_ids uuid[],p_resource_ids uuid[],p_customer_note text default null,p_internal_note text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.pet_profiles; saved uuid; old public.appointments;
begin
 if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
 select * into p from public.pet_profiles where id=p_pet_id for update;
 if p.id is null or not public.pet_care_enabled(p.organization_id) or not public.has_org_role(p.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(p.organization_id,p_branch_id) then raise exception 'Pet appointment access denied' using errcode='42501'; end if;
 if p_appointment_id is not null then
   select * into old from public.appointments where id=p_appointment_id for update;
   if old.id is null or old.organization_id<>p.organization_id or not public.can_access_branch(old.organization_id,old.branch_id) or not exists(select 1 from public.pet_appointment_details where appointment_id=old.id and pet_id=p.id) then raise exception 'Appointment not found' using errcode='42501'; end if;
   if p_staff_ids is distinct from array(select staff_profile_id from public.appointment_staff_assignments where appointment_id=old.id order by staff_profile_id) or p_resource_ids is distinct from array(select resource_id from public.appointment_resource_assignments where appointment_id=old.id order by resource_id) then raise exception 'Rescheduling must preserve assigned groomers and resources'; end if;
 end if;
 if p_appointment_id is not null then
   if old.status not in('requested','confirmed') or old.branch_id<>p_branch_id or (select array_agg(x order by x) from unnest(p_service_ids)x) is distinct from array(select service_id from public.appointment_services where appointment_id=old.id order by service_id) then raise exception 'Rescheduling preserves branch and services'; end if;
   perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
   update public.appointments set starts_at=p_starts_at,customer_note=p_customer_note,internal_note=p_internal_note where id=old.id;
   perform public.assert_pet_appointment(old.id);
   return old.id;
 end if;
 saved:=public.save_appointment_with_staff(p_appointment_id,p_branch_id,p.customer_id,null,p_service_ids,p_starts_at,p_staff_ids,p_resource_ids,p_customer_note,p_internal_note,false);
 insert into public.pet_appointment_details(appointment_id,organization_id,pet_id,customer_id_snapshot,pet_name_snapshot) values(saved,p.organization_id,p.id,p.customer_id,p.name) on conflict(appointment_id) do nothing;
 perform public.assert_pet_appointment(saved);
 return saved;
end $$;
revoke all on function public.save_pet_appointment(uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text) from public,anon;
grant execute on function public.save_pet_appointment(uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text) to authenticated;

create function public.transition_pet_appointment(p_appointment_id uuid,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments; d public.pet_appointment_details; next_status public.appointment_status;
begin
 select * into a from public.appointments where id=p_appointment_id for update;
 if not public.pet_care_enabled(a.organization_id) or not public.has_org_role(a.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(a.organization_id,a.branch_id) then raise exception 'Appointment access denied' using errcode='42501'; end if;
 select * into d from public.pet_appointment_details where appointment_id=a.id for update;
 if d.appointment_id is null then raise exception 'Grooming appointment not found'; end if;
 if p_action in('ready','collect') then
   if a.status<>'completed' then raise exception 'Finish grooming before pickup'; end if;
   if p_action='ready' and d.pickup_status='not_ready' then update public.pet_appointment_details set pickup_status='ready',ready_at=now() where appointment_id=a.id;
   elsif p_action='collect' and d.pickup_status='ready' then update public.pet_appointment_details set pickup_status='collected',collected_at=now(),collected_by=auth.uid() where appointment_id=a.id;
   elsif (p_action='ready' and d.pickup_status in('ready','collected')) or (p_action='collect' and d.pickup_status='collected') then return;
   else raise exception 'Mark ready for pickup before collection'; end if;
 else
   next_status:=case when p_action='confirm' and a.status='requested' then 'confirmed'::public.appointment_status when p_action='arrive' and a.status in('requested','confirmed') then 'checked_in'::public.appointment_status when p_action='start' and a.status='checked_in' then 'in_service'::public.appointment_status when p_action='finish' and a.status='in_service' then 'completed'::public.appointment_status when p_action='cancel' and a.status in('requested','confirmed','checked_in') then 'cancelled'::public.appointment_status when p_action='no_show' and a.status in('requested','confirmed') then 'no_show'::public.appointment_status end;
   if next_status is null then raise exception 'Invalid grooming transition'; end if;
   update public.appointments set status=next_status where id=a.id;
 end if;
 insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(a.organization_id,auth.uid(),'appointment',a.id,'pet_care.'||p_action,'{}');
end $$;
revoke all on function public.transition_pet_appointment(uuid,text) from public,anon;
grant execute on function public.transition_pet_appointment(uuid,text) to authenticated;

-- Read-only financial dashboard; actual payments, not estimated accounting revenue.
create function public.pet_care_financial_summary(p_organization_id uuid,p_branch_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tz text; result jsonb;
begin
 if not public.has_org_role(p_organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(p_organization_id,p_branch_id) or not exists(select 1 from public.organizations where id=p_organization_id and industry='pet_care') then raise exception 'Financial access denied' using errcode='42501'; end if;
 select timezone into tz from public.branches where id=p_branch_id and organization_id=p_organization_id;
 if tz is null then raise exception 'Branch not found' using errcode='42501'; end if;
 with paid as(select appointment_id,sum(amount_centavos) amount from public.payments where organization_id=p_organization_id and branch_id=p_branch_id and status='paid' group by appointment_id)
 select jsonb_build_object('outstandingCentavos',coalesce(sum(greatest(a.expected_total_centavos-coalesce(p.amount,0),0)),0),'paymentsCollectedTodayCentavos',(select coalesce(sum(amount_centavos),0) from public.payments where organization_id=p_organization_id and branch_id=p_branch_id and status='paid' and appointment_id is not null and (paid_at at time zone tz)::date=(now() at time zone tz)::date)) into result from public.appointments a join public.pet_appointment_details d on d.appointment_id=a.id left join paid p on p.appointment_id=a.id where a.organization_id=p_organization_id and a.branch_id=p_branch_id and a.status not in('cancelled','no_show');
 return result;
end $$;
revoke all on function public.pet_care_financial_summary(uuid,uuid) from public,anon;
grant execute on function public.pet_care_financial_summary(uuid,uuid) to authenticated;
