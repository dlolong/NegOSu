-- Room-scoped history with the same period and entitlement rules as Bookings.
begin;
create function public.get_hospitality_room_history(p_org uuid,p_branch uuid,p_room uuid,p_start date,p_end date,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare branch_today date; zone text; rows_json jsonb; total bigint;
begin
 if not public.hospitality_enabled(p_org) or not public.is_org_member(p_org) then
  raise exception 'Hospitality access denied' using errcode='42501';
 end if;
 select b.timezone into zone from public.hospitality_rooms r join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
 where r.id=p_room and r.organization_id=p_org and r.branch_id=p_branch and public.can_access_branch(p_org,b.id);
 if not found then raise exception 'Room not found' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end-p_start>731 or p_page is null or p_page not between 1 and 100000 then
  raise exception 'Invalid history filters' using errcode='22023';
 end if;
 branch_today:=(now() at time zone zone)::date;
 if not coalesce(public.has_entitlement(p_org,'advanced_reports'),false) and (p_end<>branch_today or p_end-p_start not in(0,6,29)) then
  raise exception 'Custom dates require a paid plan' using errcode='42501';
 end if;
 -- Match booking history: current stays plus arrivals or departures in the period.
 select count(*) into total from public.hospitality_stays s
 where s.organization_id=p_org and s.branch_id=p_branch and s.room_id=p_room and (
  s.checked_out_at is null or s.checked_in_at >= (p_start::timestamp at time zone zone) and s.checked_in_at < ((p_end+1)::timestamp at time zone zone)
  or s.checked_out_at >= (p_start::timestamp at time zone zone) and s.checked_out_at < ((p_end+1)::timestamp at time zone zone));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (
  select s.id,s.guest_name_snapshot,s.checked_in_at,s.checked_out_at from public.hospitality_stays s
  where s.organization_id=p_org and s.branch_id=p_branch and s.room_id=p_room and (
   s.checked_out_at is null or s.checked_in_at >= (p_start::timestamp at time zone zone) and s.checked_in_at < ((p_end+1)::timestamp at time zone zone)
   or s.checked_out_at >= (p_start::timestamp at time zone zone) and s.checked_out_at < ((p_end+1)::timestamp at time zone zone))
  order by (s.checked_out_at is null) desc,s.checked_in_at desc,s.id limit 50 offset (p_page-1)*50
 ) x;
 return jsonb_build_object('rows',rows_json,'rowCount',total);
end $$;
revoke all on function public.get_hospitality_room_history(uuid,uuid,uuid,date,date,integer) from public,anon;
grant execute on function public.get_hospitality_room_history(uuid,uuid,uuid,date,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
