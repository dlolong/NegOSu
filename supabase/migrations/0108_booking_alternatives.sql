begin;

-- Versioned offers retain the original request until the customer agrees.
create table public.public_booking_alternatives (
 booking_request_id uuid not null references public.public_booking_requests(id) on delete cascade,
 version integer not null check(version>0),
 starts_at timestamptz not null,
 staff_id uuid references public.organization_staff_profiles(id), staff_name text,
 resource_id uuid references public.scheduling_resources(id),
 message text not null default '' check(length(message)<=1000),
 status text not null default 'pending' check(status in ('pending','accepted','cancelled','superseded')),
 proposed_by uuid not null references auth.users(id), created_at timestamptz not null default now(), responded_at timestamptz,
 primary key(booking_request_id,version)
);
alter table public.public_booking_alternatives enable row level security;
revoke all on public.public_booking_alternatives from public,anon,authenticated;
grant select on public.public_booking_alternatives to authenticated;
create policy booking_alternatives_read on public.public_booking_alternatives for select to authenticated using (
 exists(select 1 from public.public_booking_requests r where r.id=booking_request_id
 and public.is_org_member(r.organization_id) and public.can_access_branch(r.organization_id,r.branch_id))
);

-- Shared checks at proposal, acceptance and final confirmation; offers do not hold capacity.
create function public.validate_booking_alternative(p_booking uuid,p_start timestamptz,p_staff uuid,p_resource uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; ids uuid[]; duration integer; ending timestamptz; tz text; industry text; capacity integer;
begin
 select * into r from public.public_booking_requests where id=p_booking;
 if r.id is null or r.status<>'requested' or p_start is null or p_start<=now() or p_start>now()+interval '60 days' then raise exception 'Alternative unavailable' using errcode='22023'; end if;
 select b.timezone,o.industry into tz,industry from public.branches b join public.organizations o on o.id=b.organization_id
 where b.id=r.branch_id and b.organization_id=r.organization_id and b.is_active and b.accepts_public_bookings and o.status='active';
 if tz is null then raise exception 'Alternative unavailable' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.branch_id::text,0));
 select array_agg(service_id order by service_id) into ids from public.public_booking_services where booking_request_id=r.id;
 duration:=public.public_booking_service_duration(r.organization_id,r.branch_id,ids);
 ending:=p_start+make_interval(mins=>duration);
 if not public.public_booking_slot_is_available(r.organization_id,r.branch_id,p_start,duration) then raise exception 'Alternative unavailable' using errcode='22023'; end if;
 if exists(select 1 from public.public_booking_promo_snapshots snap join public.commerce_promos p on p.id=snap.promo_id
 where snap.booking_request_id=r.id and (p.status<>'active' or (p.valid_from is not null and (p_start at time zone tz)::date<p.valid_from) or (p.valid_through is not null and (p_start at time zone tz)::date>p.valid_through))) then raise exception 'Promo unavailable on proposed date' using errcode='22023'; end if;
 if industry='pet_care' and (p_staff is null or p_resource is null) then raise exception 'Choose a groomer and resource' using errcode='22023'; end if;
 if p_staff is not null then
  perform 1 from public.organization_staff_profiles s where s.id=p_staff and s.organization_id=r.organization_id and s.is_active
   and (not exists(select 1 from public.staff_profile_branch_assignments a where a.staff_profile_id=s.id)
     or exists(select 1 from public.staff_profile_branch_assignments a where a.staff_profile_id=s.id and a.branch_id=r.branch_id)) for share;
  if not found then raise exception 'Staff unavailable' using errcode='22023'; end if;
  if exists(select 1 from public.appointment_staff_assignments sa join public.appointments a on a.id=sa.appointment_id
   where sa.staff_profile_id=p_staff and a.status in('requested','confirmed','checked_in','queued','in_service') and a.starts_at<ending and a.ends_at>p_start) then raise exception 'Staff unavailable' using errcode='22023'; end if;
 end if;
 if p_resource is not null then
  select s.capacity into capacity from public.scheduling_resources s where s.id=p_resource and s.organization_id=r.organization_id and s.branch_id=r.branch_id and s.is_active for share;
  if capacity is null or (select coalesce(sum(ra.quantity),0) from public.appointment_resource_assignments ra join public.appointments a on a.id=ra.appointment_id where ra.resource_id=p_resource and a.status in('requested','confirmed','checked_in','queued','in_service') and a.starts_at<ending and a.ends_at>p_start)>=capacity then raise exception 'Resource unavailable' using errcode='22023'; end if;
 end if;
end $$;
revoke all on function public.validate_booking_alternative(uuid,timestamptz,uuid,uuid) from public,anon,authenticated;

create function public.propose_booking_alternative(p_booking uuid,p_version integer,p_start timestamptz,p_staff uuid,p_resource uuid,p_message text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; latest public.public_booking_alternatives; next_version integer;
begin
 select * into r from public.public_booking_requests where id=p_booking for update;
 if auth.uid() is null or r.id is null or not public.has_permission(r.organization_id,'appointments.manage') or not public.can_access_branch(r.organization_id,r.branch_id) then raise exception 'Booking unavailable' using errcode='42501'; end if;
 if r.status<>'requested' or p_version is null or length(coalesce(p_message,''))>1000 then raise exception 'Invalid proposal' using errcode='22023'; end if;
 select * into latest from public.public_booking_alternatives where booking_request_id=r.id order by version desc limit 1;
 -- An identical retry of the most recent proposal returns the original version.
 if latest.version=p_version+1 and latest.proposed_by=auth.uid() and latest.status='pending' and (latest.starts_at,latest.staff_id,latest.resource_id,latest.message) is not distinct from (p_start,p_staff,p_resource,trim(coalesce(p_message,''))) then return latest.version; end if;
 if coalesce(latest.version,0)<>p_version then raise exception 'Proposal changed; reload' using errcode='40001'; end if;
 perform public.validate_booking_alternative(r.id,p_start,p_staff,p_resource);
 next_version:=p_version+1;
 update public.public_booking_alternatives set status='superseded' where booking_request_id=r.id and status='pending';
 insert into public.public_booking_alternatives(booking_request_id,version,starts_at,staff_id,staff_name,resource_id,message,proposed_by)
 values(r.id,next_version,p_start,p_staff,(select full_name from public.organization_staff_profiles where id=p_staff),p_resource,trim(coalesce(p_message,'')),auth.uid());
 update public.public_booking_requests set updated_at=now() where id=r.id;
 return next_version;
end $$;
revoke all on function public.propose_booking_alternative(uuid,integer,timestamptz,uuid,uuid,text) from public,anon;
grant execute on function public.propose_booking_alternative(uuid,integer,timestamptz,uuid,uuid,text) to authenticated;

create function public.respond_booking_alternative(p_token text,p_version integer,p_action text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; offer public.public_booking_alternatives;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_version is null or p_action is null or p_action not in('accept','cancel') then raise exception 'Invalid response' using errcode='22023'; end if;
 select * into r from public.public_booking_requests where confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if r.id is null then raise exception 'Booking unavailable' using errcode='42501'; end if;
 select * into offer from public.public_booking_alternatives where booking_request_id=r.id order by version desc limit 1;
 if offer.version is distinct from p_version then raise exception 'Proposal changed; reload' using errcode='40001'; end if;
 if offer.status='cancelled' and r.status='cancelled' and p_action='cancel' then return 'cancelled'; end if;
 if offer.status='accepted' and p_action='accept' and r.status in('requested','confirmed') then return 'accepted'; end if;
 if r.status<>'requested' or offer.status not in('pending','accepted') then raise exception 'Booking is no longer awaiting a response' using errcode='22023'; end if;
 if p_action='cancel' then
  update public.public_booking_alternatives set status='cancelled',responded_at=now() where booking_request_id=r.id and version=p_version;
  update public.public_booking_requests set status='cancelled',updated_at=now() where id=r.id;
  return 'cancelled';
 end if;
 perform public.validate_booking_alternative(r.id,offer.starts_at,offer.staff_id,offer.resource_id);
 update public.public_booking_alternatives set status='accepted',responded_at=now() where booking_request_id=r.id and version=p_version;
 update public.public_booking_requests set preferred_at=offer.starts_at,updated_at=now() where id=r.id;
 return 'accepted';
end $$;
revoke all on function public.respond_booking_alternative(text,integer,text) from public;
grant execute on function public.respond_booking_alternative(text,integer,text) to anon,authenticated;

-- Guard all review RPCs, including older clients. Confirmation waits for customer consent.
create function public.guard_booking_alternative_review() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare offer public.public_booking_alternatives;
begin
 select * into offer from public.public_booking_alternatives where booking_request_id=new.id order by version desc limit 1;
 if new.status='confirmed' and old.status is distinct from new.status and offer.status='pending' then raise exception 'Wait for the customer response' using errcode='22023'; end if;
 if new.status='confirmed' and offer.status='accepted' and new.preferred_at is distinct from offer.starts_at then raise exception 'Confirm the agreed schedule' using errcode='22023'; end if;
 return new;
end $$;
create trigger booking_alternative_review before update on public.public_booking_requests for each row execute function public.guard_booking_alternative_review();

create function public.check_booking_alternative_assignment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare offer public.public_booking_alternatives;
begin
 if new.status<>'confirmed' then return null; end if;
 select * into offer from public.public_booking_alternatives where booking_request_id=new.id order by version desc limit 1;
 if offer.status='accepted' and (not exists(select 1 from public.appointments a where a.id=new.appointment_id and a.organization_id=new.organization_id and a.branch_id=new.branch_id and a.starts_at=offer.starts_at)
 or (offer.staff_id is not null and not exists(select 1 from public.appointment_staff_assignments where appointment_id=new.appointment_id and staff_profile_id=offer.staff_id))
 or (offer.resource_id is not null and not exists(select 1 from public.appointment_resource_assignments where appointment_id=new.appointment_id and resource_id=offer.resource_id))) then raise exception 'Confirm the agreed staff and schedule' using errcode='22023'; end if;
 return null;
end $$;
create constraint trigger booking_alternative_assignment after update on public.public_booking_requests deferrable initially deferred for each row execute function public.check_booking_alternative_assignment();
revoke all on function public.guard_booking_alternative_review(),public.check_booking_alternative_assignment() from public,anon,authenticated;

create function public.confirm_booking_alternative(p_booking uuid,p_version integer,p_pet uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; offer public.public_booking_alternatives; industry text; saved uuid;
begin
 select * into r from public.public_booking_requests where id=p_booking for update;
 if auth.uid() is null or r.id is null or not public.has_permission(r.organization_id,'appointments.manage') or not public.can_access_branch(r.organization_id,r.branch_id) then raise exception 'Booking unavailable' using errcode='42501'; end if;
 select * into offer from public.public_booking_alternatives where booking_request_id=r.id order by version desc limit 1;
 if p_version is null or offer.version is distinct from p_version or offer.status<>'accepted' then raise exception 'Customer agreement required' using errcode='22023'; end if;
 if r.status='confirmed' then return r.appointment_id; end if;
 perform public.validate_booking_alternative(r.id,offer.starts_at,offer.staff_id,offer.resource_id);
 select o.industry into industry from public.organizations o where o.id=r.organization_id;
 if industry='pet_care' then
  saved:=public.confirm_pet_public_booking(r.id,p_pet,offer.staff_id,offer.resource_id);
 else
  saved:=public.review_public_booking(r.id,'confirm',null);
  if offer.staff_id is not null then insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values(r.organization_id,saved,offer.staff_id); end if;
  if offer.resource_id is not null then insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id,quantity) values(r.organization_id,saved,offer.resource_id,1); end if;
 end if;
 return saved;
end $$;
revoke all on function public.confirm_booking_alternative(uuid,integer,uuid) from public,anon;
grant execute on function public.confirm_booking_alternative(uuid,integer,uuid) to authenticated;

create or replace function public.get_public_booking_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path=public,extensions,pg_temp
as $$
  select jsonb_build_object(
    'alternative',case when r.status='requested' then (select jsonb_build_object('version',v.version,'startsAt',v.starts_at,'staffName',v.staff_name,'message',v.message,'status',v.status) from public.public_booking_alternatives v where v.booking_request_id=r.id order by v.version desc limit 1) end,
    'reference',r.public_reference,
    'status',r.status,
    'industry',o.industry,
    'timezone',b.timezone,
    'shopName',o.name,
    'logoUrl',o.logo_url,
    'shopSlug',o.slug,
    'branchName',b.name,
    'preferredAt',r.preferred_at,
    'scheduledAt',coalesce(a.starts_at,r.preferred_at),
    'appointmentStatus',case when r.status='confirmed' then a.status::text end,
    'updatedAt',greatest(r.updated_at,coalesce(a.updated_at,r.updated_at)),
    'services',(select jsonb_agg(s.service_name_snapshot order by s.service_name_snapshot) from public.public_booking_services s where s.booking_request_id=r.id),
    'currency',o.currency,
    'requestedTotalCentavos',(select coalesce(sum(s.price_centavos),0) from public.public_booking_services s where s.booking_request_id=r.id),
    'promos',(select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'priceCentavos',p.price_centavos,'currency',p.currency,
      'inclusions',(select coalesce(jsonb_agg(jsonb_build_object('name',c->>'name','quantity',c->>'quantity','unit',c->>'unit')),'[]'::jsonb) from jsonb_array_elements(p.components)c where c->>'kind'='product'))),'[]'::jsonb)
      from (select promo_id,name,currency,components,sum(price_centavos) price_centavos from public.public_booking_promo_snapshots where booking_request_id=r.id group by promo_id,name,currency,components) p),
    'declineReason',case when r.status='declined' then r.decline_reason end
  )
  from public.public_booking_requests r
  join public.organizations o on o.id=r.organization_id
  join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
  left join public.appointments a on a.id=r.appointment_id and a.organization_id=r.organization_id
  where r.confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
$$;

notify pgrst,'reload schema';
commit;
