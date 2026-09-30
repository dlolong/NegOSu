begin;

alter table public.commerce_promos add column image_url text;
alter table public.commerce_promos add column is_public boolean not null default false;
alter table public.commerce_promos add constraint commerce_promo_image_url_check check (
 image_url is null or (length(image_url)<=2048 and image_url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
);

-- New save contract includes presentation in the optimistic lock and retry payload.
-- The prior RPC remains available to older clients and preserves these new fields.
create or replace function public.save_commerce_promo_details(p_org uuid,p_branch uuid,p_id uuid,p_version integer,p_name text,p_description text,p_price bigint,p_status text,p_from date,p_through date,p_components jsonb,p_request uuid,p_image_url text,p_is_public boolean) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; receipt public.commerce_catalog_requests; payload jsonb;
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then raise exception 'Promo management access required' using errcode='42501'; end if;
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 payload:=jsonb_build_array(p_branch,p_id,p_version,p_name,p_description,p_price,p_status,p_from,p_through,p_components,p_image_url,p_is_public);
 perform pg_advisory_xact_lock(hashtextextended('commerce-catalog:'||p_org::text||':'||p_request::text,0));
 select * into receipt from public.commerce_catalog_requests where organization_id=p_org and request_key=p_request;
 if receipt.result_id is not null then
  if receipt.operation<>'promo' or receipt.payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 if p_id is null then
  insert into public.commerce_promos(organization_id,branch_id,name,description,price_centavos,currency,status,valid_from,valid_through,components,created_by,image_url,is_public)
  values(p_org,p_branch,trim(p_name),coalesce(p_description,''),p_price,(select currency from public.organizations where id=p_org),p_status,p_from,p_through,p_components,auth.uid(),nullif(trim(p_image_url),''),p_is_public) returning id into result;
 else
  update public.commerce_promos set name=trim(p_name),description=coalesce(p_description,''),price_centavos=p_price,status=p_status,valid_from=p_from,valid_through=p_through,components=p_components,image_url=nullif(trim(p_image_url),''),is_public=p_is_public
   where id=p_id and organization_id=p_org and branch_id=p_branch and version=p_version returning id into result;
  if result is null then raise exception 'Promo changed or is unavailable; reload before saving' using errcode='40001'; end if;
 end if;
 insert into public.commerce_catalog_requests(organization_id,request_key,operation,payload,result_id) values(p_org,p_request,'promo',payload,result);
 return result;
end $$;
revoke all on function public.save_commerce_promo_details(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb,uuid,text,boolean) from public,anon;
grant execute on function public.save_commerce_promo_details(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb,uuid,text,boolean) to authenticated;

-- Shared authoritative acceptance validator for staff and public booking adapters.
create function public.resolve_commerce_promo_offer(p_org uuid,p_branch uuid,p_id uuid,p_version integer,p_date date,p_public boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare promo public.commerce_promos; c jsonb; item public.inventory_items; svc public.services; sid uuid; parts jsonb:='[]';
begin
 select * into promo from public.commerce_promos where id=p_id and organization_id=p_org and branch_id=p_branch and status='active' for share;
 if promo.id is null or promo.version is distinct from p_version or p_date is null
  or (p_public and not promo.is_public) or (promo.valid_from is not null and p_date<promo.valid_from) or (promo.valid_through is not null and p_date>promo.valid_through) then raise exception 'Promo unavailable' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(promo.components) loop
  if c->>'kind'='service' then
   select * into svc from public.services where id=(c->>'referenceId')::uuid and organization_id=p_org and is_active and (not p_public or is_public) for share;
   if svc.id is null or sid is not null or svc.currency<>promo.currency then raise exception 'Promo service unavailable' using errcode='22023'; end if;
   if exists(select 1 from public.service_branch_availability where service_id=svc.id)
    and not exists(select 1 from public.service_branch_availability where service_id=svc.id and branch_id=p_branch and is_available) then raise exception 'Promo service unavailable' using errcode='22023'; end if;
   sid:=svc.id; parts:=parts||jsonb_build_array(c||jsonb_build_object('name',svc.name));
  elsif c->>'kind' in ('product','supply') then
   select * into item from public.inventory_items where id=(c->>'referenceId')::uuid and organization_id=p_org and branch_id=p_branch and is_active for share;
   if item.id is null or item.unit is distinct from c->>'unit' or (c->>'kind'='product' and item.product_purpose='internal') or (c->>'kind'='supply' and item.product_purpose='retail') then raise exception 'Promo product unavailable' using errcode='22023'; end if;
   parts:=parts||jsonb_build_array(c||jsonb_build_object('name',item.name,'stockTracked',item.stock_tracked));
  else raise exception 'Invalid appointment component' using errcode='22023'; end if;
 end loop;
 if sid is null then raise exception 'Promo service unavailable' using errcode='22023'; end if;
 return jsonb_build_object('promo',promo.id,'version',promo.version,'name',promo.name,'price',promo.price_centavos,'currency',promo.currency,'service',svc.id,'serviceName',svc.name,'duration',svc.duration_minutes,'components',parts);
end $$;
revoke all on function public.resolve_commerce_promo_offer(uuid,uuid,uuid,integer,date,boolean) from public,anon,authenticated;

-- Only explicitly published offers are exposed. Inventory and internal supplies
-- remain private; the projection returns customer-facing inclusions only.
create function public.get_public_promos(p_slug text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'branchId',p.branch_id,'name',p.name,'description',p.description,'imageUrl',p.image_url,
  'version',p.version,'priceCentavos',p.price_centavos,'currency',p.currency,'validFrom',p.valid_from,'validThrough',p.valid_through,
  'serviceId',s.id,'durationMinutes',s.duration_minutes,
  'inclusions',(select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'quantity',c->>'quantity','unit',c->>'unit')),'[]'::jsonb)
   from jsonb_array_elements(p.components)c join public.inventory_items i on i.id=(c->>'referenceId')::uuid and i.organization_id=p.organization_id and i.branch_id=p.branch_id
   where c->>'kind'='product')
 ) order by p.name,p.id),'[]'::jsonb)
 from public.commerce_promos p
 join public.organizations o on o.id=p.organization_id
 join public.branches b on b.id=p.branch_id and b.organization_id=o.id
 join lateral jsonb_array_elements(p.components) component on component->>'kind'='service'
 join public.services s on s.id=(component->>'referenceId')::uuid and s.organization_id=o.id
 where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled and o.industry in ('salon','automotive','pet_care')
  and b.is_active and b.accepts_public_bookings and p.status='active' and p.is_public and s.is_active and s.is_public
  and (p.valid_through is null or p.valid_through >= (now() at time zone b.timezone)::date)
  and (p.valid_from is null or p.valid_from <= (now() at time zone b.timezone)::date+60)
  and (not exists(select 1 from public.service_branch_availability where service_id=s.id)
    or exists(select 1 from public.service_branch_availability where service_id=s.id and branch_id=b.id and is_available))
  and not exists(select 1 from jsonb_array_elements(p.components)c where c->>'kind' in ('product','supply') and not exists(
   select 1 from public.inventory_items i where i.id=(c->>'referenceId')::uuid and i.organization_id=o.id and i.branch_id=b.id and i.is_active and i.unit=c->>'unit'
    and (c->>'kind'<>'product' or i.product_purpose<>'internal') and (c->>'kind'<>'supply' or i.product_purpose<>'retail')))
$$;
revoke all on function public.get_public_promos(text) from public;
grant execute on function public.get_public_promos(text) to anon,authenticated;

create table public.public_booking_promo_snapshots (
 booking_request_id uuid not null references public.public_booking_requests(id) on delete cascade,
 service_id uuid not null references public.services(id), organization_id uuid not null references public.organizations(id),
 branch_id uuid not null references public.branches(id), promo_id uuid not null references public.commerce_promos(id),
 version integer not null, name text not null, service_name text not null, price_centavos bigint not null check(price_centavos>=0),
 currency text not null, duration_minutes integer not null check(duration_minutes>0), components jsonb not null,
 requested_at timestamptz not null default now(), primary key(booking_request_id,service_id)
);
alter table public.public_booking_promo_snapshots enable row level security;
revoke all on public.public_booking_promo_snapshots from public,anon,authenticated;
grant select on public.public_booking_promo_snapshots to authenticated;
create policy public_booking_promos_read on public.public_booking_promo_snapshots for select to authenticated
 using(public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));

-- Reuse the canonical intake for spam limits, duplicate prevention, contact
-- validation, public service visibility, hours and availability. The offer and
-- request commit atomically; the public client never supplies a price.
create function public.submit_public_promo_booking(
 p_slug text,p_branch_id uuid,p_service_ids uuid[],p_promos jsonb,p_preferred_at timestamptz,
 p_customer_name text,p_phone text,p_email text,p_vehicle_make text,p_vehicle_model text,p_vehicle_year integer,
 p_vehicle_type text,p_plate_number text,p_pet_name text,p_species text,p_breed text,
 p_customer_note text,p_rate_key_hash text,p_honeypot text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; industry text; tz text; selection jsonb; offer jsonb; offers jsonb:='[]'; ids uuid[]:='{}'; sid uuid; response jsonb; request_id uuid;
begin
 select o.id,o.industry,b.timezone into org,industry,tz from public.organizations o join public.branches b on b.organization_id=o.id
 where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled and b.id=p_branch_id and b.is_active and b.accepts_public_bookings;
 if org is null or industry not in ('salon','pet_care','automotive') then raise exception 'Shop unavailable'; end if;
 if jsonb_typeof(p_promos) is distinct from 'array' or jsonb_array_length(p_promos) not between 1 and 10 then raise exception 'Invalid promo selection' using errcode='22023'; end if;
 -- Match the lock ordering of canonical scheduling before taking catalog locks.
 perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
 for selection in select value from jsonb_array_elements(p_promos) order by value->>'id' loop
  offer:=public.resolve_commerce_promo_offer(org,p_branch_id,(selection->>'id')::uuid,(selection->>'version')::integer,(p_preferred_at at time zone tz)::date,true);
  sid:=(offer->>'service')::uuid;
  if sid=any(ids) or not coalesce(sid=any(p_service_ids),false) then raise exception 'Select one offer per service' using errcode='22023'; end if;
  ids:=array_append(ids,sid);offers:=offers||jsonb_build_array(offer);
 end loop;
 if industry='pet_care' then
  response:=public.submit_pet_public_booking(p_slug,p_branch_id,p_service_ids,p_preferred_at,p_customer_name,p_phone,p_email,p_pet_name,p_species,p_breed,p_customer_note,p_rate_key_hash,p_honeypot);
 else
  response:=public.submit_public_booking(p_slug,p_branch_id,p_service_ids,p_preferred_at,p_customer_name,p_phone,p_email,p_vehicle_make,p_vehicle_model,p_vehicle_year,p_vehicle_type,p_plate_number,p_customer_note,p_rate_key_hash,p_honeypot);
 end if;
 select id into request_id from public.public_booking_requests where confirmation_token_hash=encode(extensions.digest(response->>'token','sha256'),'hex');
 for offer in select value from jsonb_array_elements(offers) loop
  insert into public.public_booking_promo_snapshots(booking_request_id,service_id,organization_id,branch_id,promo_id,version,name,service_name,price_centavos,currency,duration_minutes,components)
   values(request_id,(offer->>'service')::uuid,org,p_branch_id,(offer->>'promo')::uuid,(offer->>'version')::integer,offer->>'name',offer->>'serviceName',(offer->>'price')::bigint,offer->>'currency',(offer->>'duration')::integer,offer->'components');
  update public.public_booking_services set service_name_snapshot=(offer->>'name')||' · '||(offer->>'serviceName'),price_centavos=(offer->>'price')::bigint
   where booking_request_id=request_id and service_id=(offer->>'service')::uuid;
 end loop;
 return response;
end $$;
revoke all on function public.submit_public_promo_booking(text,uuid,uuid[],jsonb,timestamptz,text,text,text,text,text,integer,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_public_promo_booking(text,uuid,uuid[],jsonb,timestamptz,text,text,text,text,text,integer,text,text,text,text,text,text,text,text) to anon,authenticated;

-- Every existing confirmation path (including pet care) must carry the requested
-- terms into the appointment. No additional client-authorized mutation is exposed.
create function public.apply_public_booking_promos() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare offer public.public_booking_promo_snapshots; a public.appointments;
begin
 if new.status<>'confirmed' or new.appointment_id is null or new.appointment_id is not distinct from old.appointment_id then return new; end if;
 if not exists(select 1 from public.public_booking_promo_snapshots where booking_request_id=new.id) then return new; end if;
 if auth.uid() is null or not public.has_permission(new.organization_id,'appointments.manage') or not public.can_access_branch(new.organization_id,new.branch_id) then raise exception 'Booking request not found' using errcode='42501'; end if;
 select * into a from public.appointments where id=new.appointment_id and organization_id=new.organization_id and branch_id=new.branch_id for update;
 if a.id is null or a.source<>'public_booking' or a.starts_at is distinct from new.preferred_at then raise exception 'Invalid promo appointment'; end if;
 for offer in select * from public.public_booking_promo_snapshots where booking_request_id=new.id loop
  if not exists(select 1 from public.appointment_services where appointment_id=a.id and service_id=offer.service_id and duration_minutes=offer.duration_minutes) then raise exception 'Booked promo service duration changed'; end if;
  insert into public.appointment_promo_snapshots(appointment_id,service_id,organization_id,branch_id,promo_id,version,name,service_name,price_centavos,currency,duration_minutes,components,accepted_by)
   values(a.id,offer.service_id,offer.organization_id,offer.branch_id,offer.promo_id,offer.version,offer.name,offer.service_name,offer.price_centavos,offer.currency,offer.duration_minutes,offer.components,auth.uid());
 end loop;
 update public.appointment_services set unit_price_centavos=unit_price_centavos where appointment_id=a.id;
 return new;
end $$;
create trigger public_booking_apply_promos after update of status,appointment_id on public.public_booking_requests
 for each row execute function public.apply_public_booking_promos();
revoke all on function public.apply_public_booking_promos() from public,anon,authenticated;

-- Both intake adapters use the same offer validator.
create or replace function public.book_appointment_with_promos(
 p_request uuid,p_branch uuid,p_customer uuid,p_vehicle uuid,p_pet uuid,p_maintenance uuid,
 p_services uuid[],p_promos jsonb,p_start timestamptz,p_staff uuid[],p_resources uuid[],
 p_customer_note text,p_internal_note text,p_allow_conflict boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 org uuid; industry text; tz text; booked_date date; payload jsonb; receipt public.commerce_catalog_requests;
 selection jsonb; offer jsonb;
 service_ids uuid[]:='{}'; service_id uuid; saved uuid; snapshots jsonb:='[]';
begin
 select b.organization_id,b.timezone,o.industry into org,tz,industry from public.branches b join public.organizations o on o.id=b.organization_id where b.id=p_branch and b.is_active;
 if auth.uid() is null or org is null or not public.has_org_role(org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(org,p_branch) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_request is null or p_start is null or p_maintenance is not null or jsonb_typeof(p_promos) is distinct from 'array' or jsonb_array_length(p_promos) not between 1 and 30 then raise exception 'Invalid promo booking' using errcode='22023'; end if;
 if industry not in ('salon','pet_care','automotive') or (industry='pet_care') is distinct from (p_pet is not null) or (industry<>'automotive' and p_vehicle is not null) then raise exception 'Invalid promo context' using errcode='22023'; end if;
 payload:=jsonb_build_object('actor',auth.uid(),'branch',p_branch,'customer',p_customer,'vehicle',p_vehicle,'pet',p_pet,'services',p_services,'promos',p_promos,'start',p_start,'staff',p_staff,'resources',p_resources,'customerNote',p_customer_note,'internalNote',p_internal_note,'conflict',p_allow_conflict);
 perform pg_advisory_xact_lock(hashtextextended(org::text||p_request::text,0));
 select * into receipt from public.commerce_catalog_requests where organization_id=org and request_key=p_request;
 if found then
  if receipt.operation<>'appointment_promo' or receipt.payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 booked_date:=(p_start at time zone tz)::date;
 perform pg_advisory_xact_lock(hashtextextended(p_branch::text,0));
 for selection in select value from jsonb_array_elements(p_promos) order by value->>'id' loop
  offer:=public.resolve_commerce_promo_offer(org,p_branch,(selection->>'id')::uuid,(selection->>'version')::integer,booked_date,false);
  service_id:=(offer->>'service')::uuid;
  if service_id=any(service_ids) or not coalesce(service_id=any(p_services),false) then raise exception 'Select one offer per service' using errcode='22023'; end if;
  service_ids:=array_append(service_ids,service_id);
  snapshots:=snapshots||jsonb_build_array(offer);
 end loop;
 if p_pet is not null then
  if not exists(select 1 from public.pet_profiles where id=p_pet and organization_id=org and customer_id=p_customer and is_active) then raise exception 'Pet appointment access denied' using errcode='42501'; end if;
  saved:=public.save_pet_appointment(p_pet,null,p_branch,p_services,p_start,p_staff,p_resources,p_customer_note,p_internal_note);
 else
  saved:=public.save_appointment_with_staff(null,p_branch,p_customer,p_vehicle,p_services,p_start,p_staff,p_resources,p_customer_note,p_internal_note,p_allow_conflict);
 end if;
 for selection in select value from jsonb_array_elements(snapshots) loop
  insert into public.appointment_promo_snapshots(appointment_id,service_id,organization_id,branch_id,promo_id,version,name,service_name,price_centavos,currency,duration_minutes,components,accepted_by)
   values(saved,(selection->>'service')::uuid,org,p_branch,(selection->>'promo')::uuid,(selection->>'version')::integer,selection->>'name',selection->>'serviceName',(selection->>'price')::bigint,selection->>'currency',(selection->>'duration')::integer,selection->'components',auth.uid());
 end loop;
 -- The pricing trigger applies the saved offer; existing total triggers calculate the bill.
 update public.appointment_services set unit_price_centavos=unit_price_centavos where appointment_id=saved;
 insert into public.commerce_catalog_requests(organization_id,request_key,operation,payload,result_id) values(org,p_request,'appointment_promo',payload,saved);
 return saved;
end $$;

create or replace function public.get_public_booking_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path=public,extensions,pg_temp
as $$
  select jsonb_build_object(
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
      from public.public_booking_promo_snapshots p where p.booking_request_id=r.id),
    'declineReason',case when r.status='declined' then r.decline_reason end
  )
  from public.public_booking_requests r
  join public.organizations o on o.id=r.organization_id
  join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
  left join public.appointments a on a.id=r.appointment_id and a.organization_id=r.organization_id
  where r.confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
$$;

revoke all on function public.get_public_booking_status(text) from public;
grant execute on function public.get_public_booking_status(text) to anon,authenticated;


notify pgrst,'reload schema';
commit;
