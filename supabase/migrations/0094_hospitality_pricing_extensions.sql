-- Six room packages, audited cashier discounts, hourly extensions and deposit checkout.
create or replace function public.save_hospitality_room_with_rates(p_org uuid,p_branch uuid,p_room uuid,p_name text,p_type text,p_description text,p_capacity integer,p_active boolean,p_rates jsonb,p_expected_version integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; rid uuid; previous public.hospitality_rooms; seen uuid[]:='{}'; periods integer[]:='{}'; rate_id uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager']::public.organization_role[]);
 if p_rates is null or jsonb_typeof(p_rates)<>'array' or jsonb_array_length(p_rates) not between 1 and 6 or p_expected_version is null then raise exception 'Configure at least one room rate' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_rates) loop
  if jsonb_typeof(item)<>'object' or nullif(trim(item->>'label'),'') is null or char_length(item->>'label')>80
   or coalesce(item->>'durationMinutes','') !~ '^[0-9]+$' or coalesce(item->>'priceCentavos','') !~ '^[0-9]+$'
   or coalesce(item->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then raise exception 'Invalid room rate' using errcode='22023'; end if;
  if (item->>'durationMinutes')::numeric not in (180,360,720,1440,10080,43200) or (item->>'priceCentavos')::numeric not between 1 and 10000000000 then raise exception 'Invalid room rate' using errcode='22023'; end if;
  if item ? 'extensionHourlyCentavos' and (coalesce(item->>'extensionHourlyCentavos','') !~ '^[0-9]+$' or (item->>'extensionHourlyCentavos')::numeric not between 0 and 10000000000) then raise exception 'Invalid hourly extension price' using errcode='22023'; end if;
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

create function public.validate_hospitality_discount(p_base bigint,p_final bigint,p_kind text,p_card text) returns void language plpgsql immutable set search_path=public,pg_temp as $$
begin
 if p_base is null or p_final is null or p_final<0 or p_final>p_base or p_kind is null or p_kind not in ('none','manual','card','pwd','senior') or char_length(coalesce(p_card,''))>80
 or (p_final<p_base and p_kind='none') or (p_kind in ('card','pwd','senior') and nullif(trim(p_card),'') is null)
 or (p_kind in ('none','manual') and nullif(trim(p_card),'') is not null) then raise exception 'Review final price and discount details' using errcode='22023'; end if;
end $$;
revoke all on function public.validate_hospitality_discount(bigint,bigint,text,text) from public,anon,authenticated;
create function public.check_in_hospitality_cashier(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare room public.hospitality_rooms; rate jsonb; request_data jsonb; existing public.hospitality_stays; previous jsonb; guest public.customers;
 sid uuid; bill uuid; payment uuid; amount bigint; duration integer; label text; guest_name text; currency text; base_amount bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_request is null or p_rate is null or p_rates_version is null or p_tendered is null or p_tendered not between 0 and 1000000000000 or p_method is null
  or p_occupants is null or p_occupants not between 1 and 100 or char_length(coalesce(p_guest_name,''))>160 or char_length(coalesce(p_notes,''))>2000 or char_length(coalesce(p_reference,''))>200
 then raise exception 'Invalid arrival details' using errcode='22023'; end if;
 if p_deposit is null or p_deposit not between 0 and 10000000000 or char_length(coalesce(p_receipt,''))>80 then raise exception 'Invalid deposit or receipt' using errcode='22023'; end if;
 request_data:=jsonb_build_object('room',p_room,'rate',p_rate,'version',p_rates_version,'tendered',p_tendered,'method',p_method,'reference',nullif(trim(p_reference),''),'occupants',p_occupants,'guest',p_guest,'guestName',nullif(trim(p_guest_name),''),'notes',nullif(trim(p_notes),''),'final',p_final,'discountType',p_discount_type,'discountCard',nullif(trim(p_discount_card),''),'deposit',p_deposit,'receipt',nullif(trim(p_receipt),''));
 perform pg_advisory_xact_lock(hashtextextended('hospitality-arrival:'||p_org::text||':'||p_request::text,0));
 select * into existing from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if existing.id is not null then
  select check_in_request into previous from public.hospitality_stay_bills where stay_id=existing.id;
  if existing.branch_id<>p_branch or (jsonb_build_object('final',null,'discountType','none','discountCard',null,'deposit',0,'receipt',null)||previous) is distinct from request_data then raise exception 'Request key already used with different arrival' using errcode='22023'; end if;
  return existing.id;
 end if;
 select * into room from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if room.id is null then raise exception 'Room not found' using errcode='42501'; end if;
 if not room.is_active or exists(select 1 from public.hospitality_stays where room_id=room.id and checked_out_at is null) then raise exception 'Room is no longer vacant' using errcode='23505'; end if;
 if p_occupants>room.capacity then raise exception 'Room capacity exceeded' using errcode='22023'; end if;
 if room.rates_version<>p_rates_version then raise exception 'Room rates changed; refresh before collecting payment' using errcode='40001'; end if;
 select value into rate from jsonb_array_elements(room.rates) where (value->>'id')::uuid=p_rate;
 if rate is null then raise exception 'Choose a configured room rate' using errcode='22023'; end if;
 base_amount:=(rate->>'priceCentavos')::bigint; amount:=coalesce(p_final,base_amount); perform public.validate_hospitality_discount(base_amount,amount,p_discount_type,p_discount_card); duration:=(rate->>'durationMinutes')::integer; label:=trim(rate->>'label');
 if p_tendered<amount+p_deposit or (p_method<>'cash' and p_tendered<>amount+p_deposit) then raise exception 'Payment must cover the fixed rate; change is cash only' using errcode='22023'; end if;
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
 values(p_org,p_branch,sid,bill,rate||jsonb_build_object('currency',currency,'version',room.rates_version,'finalCentavos',amount,'discountType',p_discount_type,'discountCard',nullif(trim(p_discount_card),'')),request_data);
 perform public.set_invoice_external_receipt(bill,p_receipt);
 if p_deposit>0 then perform public.hold_invoice_deposit(bill,p_deposit,p_method,p_reference,p_request); end if;
 if amount>0 then
 payment:=public.record_invoice_collection_with_receipt(bill,amount,p_method,p_request,p_reference,null,null,currency,p_receipt);
 if p_method='cash' then update public.payments set cash_tendered_centavos=p_tendered,cash_change_centavos=p_tendered-amount-p_deposit,cash_deposit_centavos=p_deposit where id=payment; end if;
 end if;
 return sid;
end $$;
revoke all on function public.check_in_hospitality_cashier(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.check_in_hospitality_cashier(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text) to authenticated;

create or replace function public.check_in_hospitality_paid(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $$
 select public.check_in_hospitality_cashier(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,null,'none',null,0,null);
$$;
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
 if exists(select 1 from public.invoice_deposits d join public.hospitality_stay_bills sb on sb.invoice_id=d.invoice_id where sb.stay_id=s.id and d.refunded_at is null) then raise exception 'Return the refundable deposit before checkout' using errcode='22023'; end if;
 update public.hospitality_stays set checked_out_at=now(),checked_out_by=auth.uid() where id=s.id;
 update public.hospitality_rooms set cleaning_required=true,cleaning_stay_id=s.id,cleaned_at=null,cleaned_by=null where id=s.room_id;
 update public.hospitality_stay_bills set checkout_debt_acknowledged=coalesce(amount,0)>0 where stay_id=s.id;
end $$;



create function public.check_out_hospitality_with_deposit(p_org uuid,p_branch uuid,p_stay uuid,p_acknowledge_debt boolean,p_confirm_refund boolean,p_refund_method public.payment_method,p_refund_reference text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; bill uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier']::public.organization_role[]);
 perform 1 from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select id into sid from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if sid is null then raise exception 'Stay not found' using errcode='42501'; end if;
 select i.id into bill from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id where sb.stay_id=sid for update of i;
 if exists(select 1 from public.invoice_deposits where invoice_id=bill) then
  if not coalesce(p_confirm_refund,false) then raise exception 'Confirm deposit returned' using errcode='22023'; end if;
  perform public.refund_invoice_deposit(bill,p_refund_method,p_refund_reference);
 end if;
 perform public.check_out_hospitality(p_org,p_branch,p_stay,p_acknowledge_debt);
end $$;
revoke all on function public.check_out_hospitality_with_deposit(uuid,uuid,uuid,boolean,boolean,public.payment_method,text) from public,anon;
grant execute on function public.check_out_hospitality_with_deposit(uuid,uuid,uuid,boolean,boolean,public.payment_method,text) to authenticated;

create table public.hospitality_stay_extensions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,stay_id uuid not null,invoice_id uuid not null,
 request_key uuid not null,request_payload jsonb not null,rate_snapshot jsonb not null,hours integer not null check(hours between 1 and 720),
 from_at timestamptz not null,to_at timestamptz not null check(to_at>from_at),base_centavos bigint not null check(base_centavos>0),final_centavos bigint not null check(final_centavos between 0 and base_centavos),
 discount_type text not null check(discount_type in ('none','manual','card','pwd','senior')),discount_card text check(char_length(discount_card)<=80),receipt_number text check(char_length(receipt_number)<=80),
 created_at timestamptz not null default now(),created_by uuid references auth.users(id),unique(organization_id,request_key),
 foreign key(organization_id,branch_id,stay_id) references public.hospitality_stays(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,invoice_id) references public.invoices(organization_id,branch_id,id));
create index hospitality_extensions_stay on public.hospitality_stay_extensions(stay_id,created_at);
alter table public.hospitality_stay_extensions enable row level security;
revoke all on public.hospitality_stay_extensions from anon,authenticated;
grant select on public.hospitality_stay_extensions to authenticated;
create policy hospitality_extensions_read on public.hospitality_stay_extensions for select to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]) and public.can_access_branch(organization_id,branch_id));
create trigger hospitality_extensions_audit after insert on public.hospitality_stay_extensions for each row execute function public.audit_job_finance_change();

create function public.extend_hospitality_stay(p_org uuid,p_branch uuid,p_stay uuid,p_expected_end timestamptz,p_hours integer,p_rate uuid,p_rates_version integer,p_final bigint,p_discount_type text,p_discount_card text,p_tendered bigint,p_method public.payment_method,p_reference text,p_receipt text,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays; room public.hospitality_rooms; link public.hospitality_stay_bills; previous public.hospitality_stay_extensions; rate jsonb; payload jsonb; base_amount bigint; pid uuid; eid uuid; curr text; start_at timestamptz;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_request is null or p_hours is null or p_hours not between 1 and 720 or p_tendered is null or p_tendered not between 0 and 1000000000000 or p_method is null or char_length(coalesce(p_reference,''))>200 or char_length(coalesce(p_receipt,''))>80 then raise exception 'Invalid extension details' using errcode='22023'; end if;
 payload:=jsonb_build_object('stay',p_stay,'expectedEnd',p_expected_end,'hours',p_hours,'rate',p_rate,'version',p_rates_version,'final',p_final,'discountType',p_discount_type,'discountCard',nullif(trim(p_discount_card),''),'tendered',p_tendered,'method',p_method,'reference',nullif(trim(p_reference),''),'receipt',nullif(trim(p_receipt),''));
 perform pg_advisory_xact_lock(hashtextextended('hospitality-extension:'||p_org::text||':'||p_request::text,0));
 select * into previous from public.hospitality_stay_extensions where organization_id=p_org and request_key=p_request;
 if previous.id is not null then
  if previous.branch_id<>p_branch or previous.request_payload is distinct from payload then raise exception 'Extension request already used' using errcode='22023'; end if;
  return previous.id;
 end if;
 select * into room from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 if s.checked_out_at is not null then raise exception 'Stay already checked out' using errcode='55000'; end if;
 if s.planned_checkout_at is distinct from p_expected_end then raise exception 'Stay end changed; refresh' using errcode='40001'; end if;
 select * into link from public.hospitality_stay_bills where stay_id=s.id;
 perform 1 from public.invoices where id=link.invoice_id and status<>'void' for update;
 if not found then raise exception 'Active bill required' using errcode='22023'; end if;
 rate:=link.rate_snapshot;
 if coalesce((rate->>'extensionHourlyCentavos')::bigint,0)<=0 then
  if room.rates_version is distinct from p_rates_version then raise exception 'Rates changed; refresh' using errcode='40001'; end if;
  select value into rate from jsonb_array_elements(room.rates) where (value->>'id')::uuid=p_rate;
 end if;
 if rate is null or coalesce((rate->>'extensionHourlyCentavos')::bigint,0)<=0 then raise exception 'Configure an hourly extension price in Rooms' using errcode='22023'; end if;
 base_amount:=(rate->>'extensionHourlyCentavos')::bigint*p_hours;
 if base_amount>10000000000 then raise exception 'Extension amount too large' using errcode='22023'; end if;
 perform public.validate_hospitality_discount(base_amount,p_final,p_discount_type,p_discount_card);
 if p_tendered<p_final or (p_method<>'cash' and p_tendered<>p_final) then raise exception 'Payment must cover final extension price' using errcode='22023'; end if;
 start_at:=coalesce(s.planned_checkout_at,now());
 select currency into curr from public.organizations where id=p_org;
 perform public.add_manual_invoice_charge(link.invoice_id,'Room extension · '||p_hours||' hour(s)',1,p_final,p_request);
 if p_final>0 then
  pid:=public.record_invoice_collection_with_receipt(link.invoice_id,p_final,p_method,p_request,p_reference,null,null,curr,p_receipt);
  if p_method='cash' then update public.payments set cash_tendered_centavos=p_tendered,cash_change_centavos=p_tendered-p_final where id=pid; end if;
 end if;
 insert into public.hospitality_stay_extensions(organization_id,branch_id,stay_id,invoice_id,request_key,request_payload,rate_snapshot,hours,from_at,to_at,base_centavos,final_centavos,discount_type,discount_card,receipt_number,created_by)
 values(p_org,p_branch,s.id,link.invoice_id,p_request,payload,rate,p_hours,start_at,start_at+make_interval(hours=>p_hours),base_amount,p_final,p_discount_type,nullif(trim(p_discount_card),''),nullif(trim(p_receipt),''),auth.uid()) returning id into eid;
 update public.hospitality_stays set planned_checkout_at=start_at+make_interval(hours=>p_hours) where id=s.id;
 return eid;
end $$;
revoke all on function public.extend_hospitality_stay(uuid,uuid,uuid,timestamptz,integer,uuid,integer,bigint,text,text,bigint,public.payment_method,text,text,uuid) from public,anon;
grant execute on function public.extend_hospitality_stay(uuid,uuid,uuid,timestamptz,integer,uuid,integer,bigint,text,text,bigint,public.payment_method,text,text,uuid) to authenticated;
