-- Fixed room packages, optional guests and atomic paid arrival.
alter table public.hospitality_rooms add column rates jsonb not null default '[]'::jsonb check(jsonb_typeof(rates)='array' and jsonb_array_length(rates)<=20);
alter table public.hospitality_rooms add column rates_version integer not null default 0;
alter table public.hospitality_stays alter column guest_id drop not null;
alter table public.hospitality_stays add column planned_checkout_at timestamptz;
alter table public.hospitality_stays add column stay_period_label text;
alter table public.hospitality_stays add constraint hospitality_planned_departure check(planned_checkout_at is null or planned_checkout_at>checked_in_at);
alter table public.hospitality_stay_bills add column rate_snapshot jsonb;
alter table public.hospitality_stay_bills add column check_in_request jsonb;
-- Neutral Core cash receipt details. Collected amount excludes cash returned.
alter table public.payments add column cash_tendered_centavos bigint;
alter table public.payments add column cash_change_centavos bigint;
alter table public.payments add constraint payments_cash_change_check check(
 (cash_tendered_centavos is null and cash_change_centavos is null) or
 (cash_tendered_centavos is not null and cash_change_centavos is not null and method='cash'
  and cash_change_centavos>=0 and cash_tendered_centavos=amount_centavos+cash_change_centavos));

create function public.save_hospitality_room_with_rates(p_org uuid,p_branch uuid,p_room uuid,p_name text,p_type text,p_description text,p_capacity integer,p_active boolean,p_rates jsonb,p_expected_version integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; rid uuid; previous public.hospitality_rooms; seen uuid[]:='{}'; periods integer[]:='{}'; rate_id uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager']::public.organization_role[]);
 if p_rates is null or jsonb_typeof(p_rates)<>'array' or jsonb_array_length(p_rates) not between 1 and 5 or p_expected_version is null then raise exception 'Configure at least one room rate' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_rates) loop
  if jsonb_typeof(item)<>'object' or nullif(trim(item->>'label'),'') is null or char_length(item->>'label')>80
   or coalesce(item->>'durationMinutes','') !~ '^[0-9]+$' or coalesce(item->>'priceCentavos','') !~ '^[0-9]+$'
   or coalesce(item->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then raise exception 'Invalid room rate' using errcode='22023'; end if;
  if (item->>'durationMinutes')::numeric not in (180,360,720,1440,10080) or (item->>'priceCentavos')::numeric not between 1 and 10000000000 then raise exception 'Invalid room rate' using errcode='22023'; end if;
  rate_id:=(item->>'id')::uuid;
  if rate_id=any(seen) or (item->>'durationMinutes')::integer=any(periods) then raise exception 'Duplicate rate identifier or period' using errcode='22023'; end if;
  seen:=array_append(seen,rate_id);
  periods:=array_append(periods,(item->>'durationMinutes')::integer);
 end loop;
 if p_room is not null then
  select * into previous from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
  if previous.id is null then raise exception 'Room not found' using errcode='42501'; end if;
  if previous.rates_version<>p_expected_version then raise exception 'Room rates changed; refresh before saving' using errcode='40001'; end if;
 end if;
 rid:=public.save_hospitality_room(p_org,p_branch,p_room,p_name,p_type,p_description,p_capacity,p_active);
 update public.hospitality_rooms set rates=p_rates,rates_version=rates_version+case when rates is distinct from p_rates then 1 else 0 end where id=rid;
 return rid;
end $$;
revoke all on function public.save_hospitality_room_with_rates(uuid,uuid,uuid,text,text,text,integer,boolean,jsonb,integer) from public,anon;
grant execute on function public.save_hospitality_room_with_rates(uuid,uuid,uuid,text,text,text,integer,boolean,jsonb,integer) to authenticated;

-- New arrivals must use the configured rate and pay in the same transaction.
-- Retain the old definition for historical migrations; disallow direct new calls.
revoke all on function public.check_in_hospitality(uuid,uuid,uuid,uuid,integer,text,bigint,uuid) from public,anon,authenticated;
create function public.check_in_hospitality_paid(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare room public.hospitality_rooms; rate jsonb; request_data jsonb; existing public.hospitality_stays; previous jsonb; guest public.customers;
 sid uuid; bill uuid; payment uuid; amount bigint; duration integer; label text; guest_name text; currency text;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_request is null or p_rate is null or p_rates_version is null or p_tendered is null or p_tendered not between 1 and 1000000000000 or p_method is null
  or p_occupants is null or p_occupants not between 1 and 100 or char_length(coalesce(p_guest_name,''))>160 or char_length(coalesce(p_notes,''))>2000 or char_length(coalesce(p_reference,''))>200
 then raise exception 'Invalid arrival details' using errcode='22023'; end if;
 request_data:=jsonb_build_object('room',p_room,'rate',p_rate,'version',p_rates_version,'tendered',p_tendered,'method',p_method,'reference',nullif(trim(p_reference),''),'occupants',p_occupants,'guest',p_guest,'guestName',nullif(trim(p_guest_name),''),'notes',nullif(trim(p_notes),''));
 perform pg_advisory_xact_lock(hashtextextended('hospitality-arrival:'||p_org::text||':'||p_request::text,0));
 select * into existing from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if existing.id is not null then
  select check_in_request into previous from public.hospitality_stay_bills where stay_id=existing.id;
  if existing.branch_id<>p_branch or previous is distinct from request_data then raise exception 'Request key already used with different arrival' using errcode='22023'; end if;
  return existing.id;
 end if;
 select * into room from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if room.id is null then raise exception 'Room not found' using errcode='42501'; end if;
 if not room.is_active or exists(select 1 from public.hospitality_stays where room_id=room.id and checked_out_at is null) then raise exception 'Room is no longer vacant' using errcode='23505'; end if;
 if p_occupants>room.capacity then raise exception 'Room capacity exceeded' using errcode='22023'; end if;
 if room.rates_version<>p_rates_version then raise exception 'Room rates changed; refresh before collecting payment' using errcode='40001'; end if;
 select value into rate from jsonb_array_elements(room.rates) where (value->>'id')::uuid=p_rate;
 if rate is null then raise exception 'Choose a configured room rate' using errcode='22023'; end if;
 amount:=(rate->>'priceCentavos')::bigint; duration:=(rate->>'durationMinutes')::integer; label:=trim(rate->>'label');
 if p_tendered<amount or (p_method<>'cash' and p_tendered<>amount) then raise exception 'Payment must cover the fixed rate; change is cash only' using errcode='22023'; end if;
 if p_guest is not null then
  select * into guest from public.customers where id=p_guest and organization_id=p_org and not is_archived;
  if guest.id is null then raise exception 'Guest not found' using errcode='42501'; end if;
 end if;
 guest_name:=coalesce(nullif(trim(p_guest_name),''),guest.full_name,'Walk-in');
 insert into public.hospitality_stays(organization_id,branch_id,room_id,guest_id,room_name_snapshot,guest_name_snapshot,occupants,notes,created_by,request_key,planned_checkout_at,stay_period_label)
 values(p_org,p_branch,room.id,p_guest,room.name,guest_name,p_occupants,nullif(trim(p_notes),''),auth.uid(),p_request,now()+make_interval(mins=>duration),label) returning id into sid;
 select o.currency into currency from public.organizations o where o.id=p_org;
 bill:=public.create_manual_invoice(p_org,p_branch,guest_name);
 perform public.add_manual_invoice_charge(bill,'Room '||room.name||' · '||label,1,amount,p_request);
 insert into public.hospitality_stay_bills(organization_id,branch_id,stay_id,invoice_id,rate_snapshot,check_in_request)
 values(p_org,p_branch,sid,bill,rate||jsonb_build_object('currency',currency,'version',room.rates_version),request_data);
 payment:=public.record_invoice_collection(bill,amount,p_method,p_request,p_reference,null,null,currency);
 if p_method='cash' then update public.payments set cash_tendered_centavos=p_tendered,cash_change_centavos=p_tendered-amount where id=payment; end if;
 return sid;
end $$;
revoke all on function public.check_in_hospitality_paid(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid) from public,anon;
grant execute on function public.check_in_hospitality_paid(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid) to authenticated;

create or replace function public.check_out_hospitality(p_org uuid,p_branch uuid,p_stay uuid,p_acknowledge_debt boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays; amount bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier']::public.organization_role[]);
 -- Lock order: room, stay, invoice. Same order as check-in and room edits.
 perform 1 from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 if s.checked_out_at is not null then return; end if;
 select i.balance_centavos into amount from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id where sb.stay_id=s.id and i.status<>'void' for update of i;
 if coalesce(amount,0)>0 and not coalesce(p_acknowledge_debt,false) then raise exception 'Acknowledge the outstanding balance before checkout' using errcode='22023'; end if;
 update public.hospitality_stays set checked_out_at=now(),checked_out_by=auth.uid() where id=s.id;
 update public.hospitality_stay_bills set checkout_debt_acknowledged=coalesce(amount,0)>0 where stay_id=s.id;
end $$;


create view public.hospitality_room_availability with(security_invoker=true) as
select r.*,s.id as stay_id,s.planned_checkout_at,s.stay_period_label,s.occupants,
 case when s.id is not null then 'occupied' when not r.is_active then 'inactive' else 'vacant' end as occupancy_status
from public.hospitality_rooms r left join public.hospitality_stays s on s.room_id=r.id and s.checked_out_at is null;
revoke all on public.hospitality_room_availability from public,anon;
grant select on public.hospitality_room_availability to authenticated;
