begin;

-- Keep one immutable allocation per included service. Existing snapshots are unchanged.
alter table public.appointment_promo_snapshots drop constraint appointment_promo_snapshots_appointment_id_promo_id_key;

create or replace function public.validate_commerce_promo() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare c jsonb; org public.organizations; item public.inventory_items; service public.services; billable integer:=0; keys text[]:='{}'; k text; q numeric;
begin
 if tg_op='UPDATE' and new.status='archived' and
  (new.organization_id,new.branch_id,new.name,new.description,new.price_centavos,new.currency,new.valid_from,new.valid_through,new.components)
  is not distinct from (old.organization_id,old.branch_id,old.name,old.description,old.price_centavos,old.currency,old.valid_from,old.valid_through,old.components) then
  new.version:=old.version+1; new.updated_at:=now(); return new;
 end if;
 select * into org from public.organizations where id=new.organization_id;
 if org.industry not in ('salon','automotive','pet_care','hospitality') or new.currency is distinct from org.currency then raise exception 'Invalid promo business or currency' using errcode='22023'; end if;
 if jsonb_typeof(new.components)<>'array' or jsonb_array_length(new.components) not between 2 and 30 then raise exception 'A promo needs a billable component and included products' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(new.components) loop
  if c->>'kind' is null or c->>'kind' not in ('service','accommodation','product','supply') or coalesce(c->>'quantity','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$' then raise exception 'Invalid promo component' using errcode='22023'; end if;
  q:=(c->>'quantity')::numeric;
  if q<=0 or nullif(trim(c->>'unit'),'') is null then raise exception 'Invalid component quantity or unit' using errcode='22023'; end if;
  k:=(c->>'kind')||':'||coalesce(c->>'referenceId','');
  if k=any(keys) then raise exception 'Duplicate promo component' using errcode='22023'; end if;
  keys:=array_append(keys,k);
  if c->>'kind' in ('service','accommodation') then
   billable:=billable+1;
   if q<>1 or c->>'unit'<>'service' then raise exception 'Billable components require one service unit' using errcode='22023'; end if;
   if c->>'kind'='accommodation' then
    if org.industry<>'hospitality' or c->>'referenceId' is not null then raise exception 'Accommodation requires a stay context' using errcode='22023'; end if;
   else
    select * into service from public.services where id=(c->>'referenceId')::uuid and organization_id=new.organization_id and is_active;
    if service.id is null or service.currency is distinct from org.currency or org.industry='hospitality' then raise exception 'Service unavailable' using errcode='22023'; end if;
   end if;
  else
   select * into item from public.inventory_items where id=(c->>'referenceId')::uuid and organization_id=new.organization_id and branch_id=new.branch_id and is_active;
   if item.id is null or item.unit is distinct from c->>'unit' then raise exception 'Product unavailable or unsupported unit conversion' using errcode='22023'; end if;
   if (c->>'kind'='product' and item.product_purpose='internal') or (c->>'kind'='supply' and item.product_purpose='retail') then raise exception 'Product purpose does not match component' using errcode='22023'; end if;
  end if;
 end loop;
 if (org.industry='hospitality' and billable<>1) or (org.industry<>'hospitality' and billable<1) then raise exception 'Include at least one service, or one accommodation for hospitality' using errcode='22023'; end if;
 if new.is_public and org.industry<>'hospitality' and billable>10 then raise exception 'Public booking supports up to 10 services per promo' using errcode='22023'; end if;
 if tg_op='UPDATE' then
  if (new.organization_id,new.branch_id) is distinct from (old.organization_id,old.branch_id) then raise exception 'Promo ownership cannot change' using errcode='22023'; end if;
  new.version:=old.version+1;
 end if;
 new.updated_at:=now(); return new;
end $$;

create or replace function public.resolve_commerce_promo_offer(p_org uuid,p_branch uuid,p_id uuid,p_version integer,p_date date,p_public boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare promo public.commerce_promos; c jsonb; item public.inventory_items; svc public.services; sid uuid; parts jsonb:='[]'; services jsonb:='[]'; offers jsonb:='[]'; entry jsonb; n bigint; allocation_index bigint:=0;
begin
 select * into promo from public.commerce_promos where id=p_id and organization_id=p_org and branch_id=p_branch and status='active' for share;
 if promo.id is null or promo.version is distinct from p_version or p_date is null
  or (p_public and not promo.is_public) or (promo.valid_from is not null and p_date<promo.valid_from) or (promo.valid_through is not null and p_date>promo.valid_through) then raise exception 'Promo unavailable' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(promo.components) loop
  if c->>'kind'='service' then
   select * into svc from public.services where id=(c->>'referenceId')::uuid and organization_id=p_org and is_active and (not p_public or is_public) for share;
   if svc.id is null or svc.currency<>promo.currency then raise exception 'Promo service unavailable' using errcode='22023'; end if;
   if exists(select 1 from public.service_branch_availability where service_id=svc.id)
    and not exists(select 1 from public.service_branch_availability where service_id=svc.id and branch_id=p_branch and is_available) then raise exception 'Promo service unavailable' using errcode='22023'; end if;
   sid:=svc.id; services:=services||jsonb_build_array(jsonb_build_object('service',svc.id,'serviceName',svc.name,'duration',svc.duration_minutes)); parts:=parts||jsonb_build_array(c||jsonb_build_object('name',svc.name));
  elsif c->>'kind' in ('product','supply') then
   select * into item from public.inventory_items where id=(c->>'referenceId')::uuid and organization_id=p_org and branch_id=p_branch and is_active for share;
   if item.id is null or item.unit is distinct from c->>'unit' or (c->>'kind'='product' and item.product_purpose='internal') or (c->>'kind'='supply' and item.product_purpose='retail') then raise exception 'Promo product unavailable' using errcode='22023'; end if;
   parts:=parts||jsonb_build_array(c||jsonb_build_object('name',item.name,'stockTracked',item.stock_tracked));
  else raise exception 'Invalid appointment component' using errcode='22023'; end if;
 end loop;
 if sid is null then raise exception 'Promo service unavailable' using errcode='22023'; end if;
 -- Split minor units deterministically across service lines; their sum is the fixed price.
 -- This is an accounting allocation, not a change to the customer's bundle price.
 n:=jsonb_array_length(services);
 for entry in select value from jsonb_array_elements(services) order by value->>'service' loop
  offers:=offers||jsonb_build_array(entry||jsonb_build_object('promo',promo.id,'version',promo.version,'name',promo.name,
   'price',promo.price_centavos/n+case when allocation_index<mod(promo.price_centavos,n) then 1 else 0 end,
   'currency',promo.currency,'components',parts));
  allocation_index:=allocation_index+1;
 end loop;
 return jsonb_build_object('offers',offers);
end $$;

create or replace function public.submit_public_promo_booking(
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
  for offer in select value from jsonb_array_elements(public.resolve_commerce_promo_offer(org,p_branch_id,(selection->>'id')::uuid,(selection->>'version')::integer,(p_preferred_at at time zone tz)::date,true)->'offers') loop
  sid:=(offer->>'service')::uuid;
  if sid=any(ids) or not coalesce(sid=any(p_service_ids),false) then raise exception 'Select one offer per service' using errcode='22023'; end if;
  ids:=array_append(ids,sid);offers:=offers||jsonb_build_array(offer);
  end loop;
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
  for offer in select value from jsonb_array_elements(public.resolve_commerce_promo_offer(org,p_branch,(selection->>'id')::uuid,(selection->>'version')::integer,booked_date,false)->'offers') loop
  service_id:=(offer->>'service')::uuid;
  if service_id=any(service_ids) or not coalesce(service_id=any(p_services),false) then raise exception 'Select one offer per service' using errcode='22023'; end if;
  service_ids:=array_append(service_ids,service_id);
  snapshots:=snapshots||jsonb_build_array(offer);
  end loop;
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

create or replace function public.get_public_promos(p_slug text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'branchId',p.branch_id,'name',p.name,'description',p.description,'imageUrl',p.image_url,
  'version',p.version,'priceCentavos',p.price_centavos,'currency',p.currency,'validFrom',p.valid_from,'validThrough',p.valid_through,
  'serviceId',s.id,'serviceIds',s.ids,'durationMinutes',s.duration_minutes,
  'inclusions',(select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'quantity',c->>'quantity','unit',c->>'unit')),'[]'::jsonb)
   from jsonb_array_elements(p.components)c join public.inventory_items i on i.id=(c->>'referenceId')::uuid and i.organization_id=p.organization_id and i.branch_id=p.branch_id
   where c->>'kind'='product')
 ) order by p.name,p.id),'[]'::jsonb)
 from public.commerce_promos p
 join public.organizations o on o.id=p.organization_id
 join public.branches b on b.id=p.branch_id and b.organization_id=o.id
 join lateral (
  select (array_agg(svc.id order by svc.id))[1] id,jsonb_agg(svc.id order by svc.id) ids,sum(svc.duration_minutes) duration_minutes,
   bool_and(svc.is_active and svc.is_public and svc.currency=p.currency
    and (not exists(select 1 from public.service_branch_availability where service_id=svc.id)
      or exists(select 1 from public.service_branch_availability where service_id=svc.id and branch_id=b.id and is_available))) available,
   count(svc.id)=count(*) complete
  from jsonb_array_elements(p.components) component
  left join public.services svc on svc.id=(component->>'referenceId')::uuid and svc.organization_id=o.id
  where component->>'kind'='service'
 ) s on s.id is not null and s.complete and s.available
 where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled and o.industry in ('salon','automotive','pet_care')
  and b.is_active and b.accepts_public_bookings and p.status='active' and p.is_public
  and (p.valid_through is null or p.valid_through >= (now() at time zone b.timezone)::date)
  and (p.valid_from is null or p.valid_from <= (now() at time zone b.timezone)::date+60)
  and not exists(select 1 from jsonb_array_elements(p.components)c where c->>'kind' in ('product','supply') and not exists(
   select 1 from public.inventory_items i where i.id=(c->>'referenceId')::uuid and i.organization_id=o.id and i.branch_id=b.id and i.is_active and i.unit=c->>'unit'
    and (c->>'kind'<>'product' or i.product_purpose<>'internal') and (c->>'kind'<>'supply' or i.product_purpose<>'retail')))
$$;

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
