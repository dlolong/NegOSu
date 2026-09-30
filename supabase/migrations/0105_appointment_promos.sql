begin;

-- Accepted booking offers are immutable. Stock use/handover remains a separate operation.
create table public.appointment_promo_snapshots (
 appointment_id uuid not null references public.appointments(id) on delete cascade,
 service_id uuid not null references public.services(id),
 organization_id uuid not null references public.organizations(id),
 branch_id uuid not null references public.branches(id),
 promo_id uuid not null references public.commerce_promos(id), version integer not null,
 name text not null, service_name text not null, price_centavos bigint not null check(price_centavos>=0),
 currency text not null, duration_minutes integer not null check(duration_minutes>0),
 components jsonb not null, accepted_by uuid not null references auth.users(id), accepted_at timestamptz not null default now(),
 primary key(appointment_id,service_id), unique(appointment_id,promo_id)
);
alter table public.appointment_promo_snapshots enable row level security;
revoke all on public.appointment_promo_snapshots from public,anon,authenticated;
grant select on public.appointment_promo_snapshots to authenticated;
create policy appointment_promos_read on public.appointment_promo_snapshots for select to authenticated
 using(public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));

-- Run after normal service validation/pricing; accepted prices cannot be overwritten
-- by client updates or by the existing delete/reinsert appointment edit transaction.
create function public.apply_appointment_promo_snapshot() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare offer public.appointment_promo_snapshots;
begin
 select * into offer from public.appointment_promo_snapshots where appointment_id=new.appointment_id and service_id=new.service_id;
 if found then
  if tg_op='INSERT' and new.duration_minutes<>offer.duration_minutes then
   raise exception 'Booked promo service duration changed';
  end if;
  new.service_name_snapshot:=offer.name||' · '||offer.service_name;
  new.unit_price_centavos:=offer.price_centavos;
  new.duration_minutes:=offer.duration_minutes;
 end if;
 return new;
end $$;
create trigger zz_appointment_promo_price before insert or update on public.appointment_services
 for each row execute function public.apply_appointment_promo_snapshot();

-- Deferred check permits the existing atomic service replacement but prevents
-- quietly dropping a purchased promo or moving it to another branch/customer.
create function public.check_appointment_promo_integrity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid;
begin
 if tg_table_name='appointments' then
  target:=new.id;
  if (new.branch_id,new.customer_id,new.vehicle_id) is distinct from (old.branch_id,old.customer_id,old.vehicle_id)
    and exists(select 1 from public.appointment_promo_snapshots where appointment_id=target) then
   raise exception 'Booked promos preserve branch and customer';
  end if;
 else
  target:=old.appointment_id;
 end if;
 if exists(select 1 from public.appointment_promo_snapshots p where p.appointment_id=target
   and not exists(select 1 from public.appointment_services s where s.appointment_id=p.appointment_id and s.service_id=p.service_id)) then
  raise exception 'Booked promo services cannot be removed';
 end if;
 return null;
end $$;
create constraint trigger appointment_promo_services_required after delete or update on public.appointment_services
 deferrable initially deferred for each row execute function public.check_appointment_promo_integrity();
create constraint trigger appointment_promo_identity after update on public.appointments
 deferrable initially deferred for each row execute function public.check_appointment_promo_integrity();

create function public.book_appointment_with_promos(
 p_request uuid,p_branch uuid,p_customer uuid,p_vehicle uuid,p_pet uuid,p_maintenance uuid,
 p_services uuid[],p_promos jsonb,p_start timestamptz,p_staff uuid[],p_resources uuid[],
 p_customer_note text,p_internal_note text,p_allow_conflict boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 org uuid; industry text; tz text; booked_date date; payload jsonb; receipt public.commerce_catalog_requests;
 selection jsonb; promo public.commerce_promos; component jsonb; item public.inventory_items; service public.services;
 service_ids uuid[]:='{}'; seen uuid[]:='{}'; service_id uuid; saved uuid; snapshots jsonb:='[]'; parts jsonb;
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
 -- Deterministic locks protect the offer while accepting its immutable snapshot.
 perform 1 from public.commerce_promos where id in(select (value->>'id')::uuid from jsonb_array_elements(p_promos)) order by id for share;
 for selection in select value from jsonb_array_elements(p_promos) loop
  select * into promo from public.commerce_promos where id=(selection->>'id')::uuid and organization_id=org and branch_id=p_branch and status='active';
  if promo.id is null or promo.version is distinct from (selection->>'version')::integer or promo.id=any(seen)
   or (promo.valid_from is not null and booked_date<promo.valid_from) or (promo.valid_through is not null and booked_date>promo.valid_through) then
   raise exception 'Promo unavailable' using errcode='22023';
  end if;
  seen:=array_append(seen,promo.id); parts:='[]'; service_id:=null;
  for component in select value from jsonb_array_elements(promo.components) loop
   if component->>'kind'='service' then
    select * into service from public.services where id=(component->>'referenceId')::uuid and organization_id=org and is_active for share;
    if service.id is null or service_id is not null or service.currency<>promo.currency then raise exception 'Promo service unavailable' using errcode='22023'; end if;
    service_id:=service.id;
    parts:=parts||jsonb_build_array(component||jsonb_build_object('name',service.name));
   elsif component->>'kind' in ('product','supply') then
    select * into item from public.inventory_items where id=(component->>'referenceId')::uuid and organization_id=org and branch_id=p_branch and is_active for share;
    if item.id is null or item.unit is distinct from component->>'unit'
     or (component->>'kind'='product' and item.product_purpose='internal') or (component->>'kind'='supply' and item.product_purpose='retail') then raise exception 'Promo product unavailable' using errcode='22023'; end if;
    parts:=parts||jsonb_build_array(component||jsonb_build_object('name',item.name,'stockTracked',item.stock_tracked));
   else raise exception 'Invalid appointment component' using errcode='22023';
   end if;
  end loop;
  if service_id is null or service_id=any(service_ids) or not coalesce(service_id=any(p_services),false) then raise exception 'Select one offer per service' using errcode='22023'; end if;
  service_ids:=array_append(service_ids,service_id);
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('promo',promo.id,'version',promo.version,'name',promo.name,'price',promo.price_centavos,'currency',promo.currency,'service',service.id,'serviceName',service.name,'duration',service.duration_minutes,'components',parts));
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
revoke all on function public.book_appointment_with_promos(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb,timestamptz,uuid[],uuid[],text,text,boolean) from public,anon;
grant execute on function public.book_appointment_with_promos(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb,timestamptz,uuid[],uuid[],text,text,boolean) to authenticated;
revoke all on function public.apply_appointment_promo_snapshot(),public.check_appointment_promo_integrity() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
