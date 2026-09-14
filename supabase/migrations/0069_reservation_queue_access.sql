-- Customer queues require an existing confirmed reservation. Slug/branch
-- knowledge and a staff login alone never grant access to this projection.
begin;

revoke all on function public.get_public_salon_queue(text,uuid) from public,anon,authenticated;

create function public.get_reservation_queue(p_booking_token text)
returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare reservation record;
begin
  if p_booking_token is null or p_booking_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select o.slug,b.id as branch_id into reservation
  from public.public_booking_requests r
  join public.appointments a on a.id=r.appointment_id
    and a.organization_id=r.organization_id and a.branch_id=r.branch_id
  join public.organizations o on o.id=r.organization_id
    and o.industry='salon' and o.status='active' and o.public_page_enabled
  join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id and b.is_active
  where r.confirmation_token_hash=encode(extensions.digest(p_booking_token,'sha256'),'hex')
    and r.status='confirmed' and a.status in('confirmed','checked_in','in_service')
    and (a.starts_at at time zone b.timezone)::date=(now() at time zone b.timezone)::date;
  if not found then return null; end if;

  -- Reuse the existing privacy-limited queue projection. Only this definer
  -- function may call it for customers; both scope values came from the token.
  return public.get_public_salon_queue(reservation.slug,reservation.branch_id);
end $$;

revoke all on function public.get_reservation_queue(text) from public;
grant execute on function public.get_reservation_queue(text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
