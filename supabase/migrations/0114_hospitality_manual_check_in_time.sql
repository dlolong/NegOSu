-- Record the effective arrival separately from the time staff enter it.
-- Legacy stays remain unchanged; no historical recording times are invented.
begin;
alter table public.hospitality_stays add column check_in_recorded_at timestamptz;
alter table public.hospitality_stays add constraint hospitality_recorded_arrival_time check (
 check_in_recorded_at is null or (
  isfinite(checked_in_at) and isfinite(check_in_recorded_at) and checked_in_at <= check_in_recorded_at
 )
);

create function public.check_in_hospitality_at(
 p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,
 p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,
 p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,
 p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text,
 p_cashier uuid,p_housekeeper uuid,p_check_in_at timestamptz
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.hospitality_stays; sid uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 if p_request is null or p_check_in_at is null or not isfinite(p_check_in_at) then
  raise exception 'A valid arrival time and request key are required' using errcode='22007';
 end if;
 -- Keep the same lock order as the existing arrival transaction: request, room, stay, invoice.
 perform pg_advisory_xact_lock(hashtextextended('hospitality-arrival:'||p_org::text||':'||p_request::text,0));
 select * into existing from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if existing.id is not null then
  if existing.branch_id<>p_branch or existing.check_in_recorded_at is null or existing.checked_in_at is distinct from p_check_in_at then
   raise exception 'Arrival was already recorded with different details' using errcode='40001';
  end if;
  -- Reuse all original payload and staff retry validation, even after checkout.
  return public.check_in_hospitality_shift(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,p_final,p_discount_type,p_discount_card,p_deposit,p_receipt,p_cashier,p_housekeeper);
 end if;
 if p_check_in_at>now() then raise exception 'Arrival cannot be in the future' using errcode='22007'; end if;
 perform 1 from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if not found then raise exception 'Room not found' using errcode='42501'; end if;
 -- A new arrival is still in house, so its occupancy interval extends from arrival to infinity.
 -- A completed stay ending exactly at arrival is allowed. The room lock serializes checkout/reuse.
 if exists(select 1 from public.hospitality_stays where room_id=p_room
   and (checked_out_at is null or checked_out_at>p_check_in_at)) then
  raise exception 'Arrival overlaps a recorded room stay' using errcode='23P01';
 end if;
 sid:=public.check_in_hospitality_shift(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,p_final,p_discount_type,p_discount_card,p_deposit,p_receipt,p_cashier,p_housekeeper);
 -- The existing transaction owns prices, payment/deposit, staff, cleaning and capacity validation.
 -- Shift the paid period by the same amount as arrival; retain actual ledger/staff recording times.
 update public.hospitality_stays set
  planned_checkout_at=p_check_in_at+(planned_checkout_at-checked_in_at),
  checked_in_at=p_check_in_at,check_in_recorded_at=now()
 where id=sid;
 return sid;
end $$;
revoke all on function public.check_in_hospitality_at(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.check_in_hospitality_at(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
