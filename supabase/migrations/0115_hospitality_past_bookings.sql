-- Canonical paid-stay creation supports historical closed intervals without changing live room state.
-- Existing arrival RPC signatures and payloads remain compatible.
begin;
create function public.create_hospitality_paid_stay(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text,p_arrival timestamptz,p_departure timestamptz,p_history jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare room public.hospitality_rooms; rate jsonb; request_data jsonb; existing public.hospitality_stays; previous jsonb; guest public.customers;
 sid uuid; bill uuid; payment uuid; amount bigint; duration integer; label text; guest_name text; currency text; base_amount bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_request is null or p_rate is null or p_rates_version is null or p_tendered is null or p_tendered not between 0 and 1000000000000 or p_method is null
  or p_occupants is null or p_occupants not between 1 and 100 or char_length(coalesce(p_guest_name,''))>160 or char_length(coalesce(p_notes,''))>2000 or char_length(coalesce(p_reference,''))>200
 then raise exception 'Invalid arrival details' using errcode='22023'; end if;
 if p_deposit is null or p_deposit not between 0 and 10000000000 or char_length(coalesce(p_receipt,''))>80 then raise exception 'Invalid deposit or receipt' using errcode='22023'; end if;
 if p_arrival is null or not isfinite(p_arrival) or p_arrival>now() or (p_departure is not null and (not isfinite(p_departure) or p_departure<=p_arrival or p_departure>now())) then raise exception 'Invalid stay dates' using errcode='22007'; end if;
 request_data:=jsonb_build_object('room',p_room,'rate',p_rate,'version',p_rates_version,'tendered',p_tendered,'method',p_method,'reference',nullif(trim(p_reference),''),'occupants',p_occupants,'guest',p_guest,'guestName',nullif(trim(p_guest_name),''),'notes',nullif(trim(p_notes),''),'final',p_final,'discountType',p_discount_type,'discountCard',nullif(trim(p_discount_card),''),'deposit',p_deposit,'receipt',nullif(trim(p_receipt),''))||coalesce(p_history,'{}'::jsonb);
 perform pg_advisory_xact_lock(hashtextextended('hospitality-arrival:'||p_org::text||':'||p_request::text,0));
 select * into existing from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if existing.id is not null then
  select check_in_request into previous from public.hospitality_stay_bills where stay_id=existing.id;
  if existing.branch_id<>p_branch or (jsonb_build_object('final',null,'discountType','none','discountCard',null,'deposit',0,'receipt',null)||previous) is distinct from request_data then raise exception 'Request key already used with different arrival' using errcode='22023'; end if;
  return existing.id;
 end if;
 select * into room from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if room.id is null then raise exception 'Room not found' using errcode='42501'; end if;
 if p_departure is null and (not room.is_active or exists(select 1 from public.hospitality_stays where room_id=room.id and checked_out_at is null)) then raise exception 'Room is no longer vacant' using errcode='23505'; end if;
 if exists(select 1 from public.hospitality_stays s where s.room_id=room.id
  and s.checked_in_at<coalesce(p_departure,'infinity'::timestamptz)
  and coalesce(s.checked_out_at,'infinity'::timestamptz)>p_arrival) then
  raise exception 'Stay overlaps recorded room history' using errcode='23P01';
 end if;
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
 insert into public.hospitality_stays(organization_id,branch_id,room_id,guest_id,room_name_snapshot,guest_name_snapshot,occupants,notes,created_by,request_key,planned_checkout_at,stay_period_label,checked_in_at,checked_out_at,checked_out_by,check_in_recorded_at)
 values(p_org,p_branch,room.id,p_guest,room.name,guest_name,p_occupants,nullif(trim(p_notes),''),auth.uid(),p_request,p_arrival+make_interval(mins=>duration),label,p_arrival,p_departure,case when p_departure is not null then auth.uid() end,case when p_history is not null then now() end) returning id into sid;
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
revoke all on function public.create_hospitality_paid_stay(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,timestamptz,timestamptz,jsonb) from public,anon,authenticated;

create or replace function public.check_in_hospitality_cashier(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text)
returns uuid language sql security definer set search_path=public,pg_temp as $$
 select public.create_hospitality_paid_stay(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,p_final,p_discount_type,p_discount_card,p_deposit,p_receipt,now(),null,null);
$$;

create function public.record_hospitality_past_booking(
 p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,
 p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,
 p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,
 p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text,
 p_cashier uuid,p_housekeeper uuid,p_check_in_at timestamptz,p_check_out_at timestamptz,
 p_checkout_cashier uuid,p_checkout_housekeeper uuid,p_confirm_refund boolean,
 p_refund_method public.payment_method,p_refund_reference text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; bill uuid; history jsonb;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_check_in_at is null or not isfinite(p_check_in_at) or p_check_in_at>=now()
  or (p_check_out_at is not null and (not isfinite(p_check_out_at) or p_check_out_at<=p_check_in_at or p_check_out_at>now())) then
  raise exception 'Enter past arrival and valid checkout dates' using errcode='22007';
 end if;
 if p_check_out_at is not null and (p_checkout_cashier is null or p_checkout_housekeeper is null) then
  raise exception 'Select checkout staff' using errcode='22023';
 end if;
 if p_check_out_at is not null and p_deposit>0 and (not coalesce(p_confirm_refund,false) or p_refund_method is null or length(coalesce(p_refund_reference,''))>200) then
  raise exception 'Confirm the deposit was returned' using errcode='22023';
 end if;
 history:=jsonb_build_object('pastBooking',true,'arrival',p_check_in_at at time zone 'UTC','departure',p_check_out_at at time zone 'UTC',
  'cashier',p_cashier,'housekeeper',p_housekeeper,'checkoutCashier',case when p_check_out_at is not null then p_checkout_cashier end,
  'checkoutHousekeeper',case when p_check_out_at is not null then p_checkout_housekeeper end,
  'refundConfirmed',case when p_check_out_at is not null and p_deposit>0 then p_confirm_refund end,
  'refundMethod',case when p_check_out_at is not null and p_deposit>0 then p_refund_method end,
  'refundReference',case when p_check_out_at is not null and p_deposit>0 then nullif(trim(p_refund_reference),'') end);
 sid:=public.create_hospitality_paid_stay(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,p_final,p_discount_type,p_discount_card,p_deposit,p_receipt,p_check_in_at,p_check_out_at,history);
 perform public.record_hospitality_shift_staff(p_org,p_branch,sid,'check_in',p_cashier,p_housekeeper);
 if p_check_out_at is not null then
  perform public.record_hospitality_shift_staff(p_org,p_branch,sid,'check_out',p_checkout_cashier,p_checkout_housekeeper);
  if p_deposit>0 then
   select invoice_id into bill from public.hospitality_stay_bills where stay_id=sid;
   perform public.refund_invoice_deposit(bill,p_refund_method,p_refund_reference);
  end if;
 end if;
 -- Closed history was inserted as closed: never occupy, check out or reset cleaning on the live room.
 return sid;
end $$;
revoke all on function public.record_hospitality_past_booking(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid,timestamptz,timestamptz,uuid,uuid,boolean,public.payment_method,text) from public,anon;
grant execute on function public.record_hospitality_past_booking(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid,timestamptz,timestamptz,uuid,uuid,boolean,public.payment_method,text) to authenticated;
notify pgrst,'reload schema';
commit;
