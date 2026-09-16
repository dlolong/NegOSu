-- Some upgraded databases retain an obsolete four-argument overload alongside
-- the canonical five-argument helper (whose last argument defaults to false).
-- Four-argument calls from the public calendar then fail with SQLSTATE 42725.
-- Keep the canonical Core/Pet Care validator and its existing default argument.
-- No CASCADE: unexpected dependencies must stop deployment rather than be removed.
do $$
begin
  if to_regprocedure('public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer,boolean)') is null then
    raise exception 'Apply the canonical public booking migrations before 0079';
  end if;
end $$;
drop function if exists public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer);
revoke all on function public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer,boolean) from public,anon,authenticated;
