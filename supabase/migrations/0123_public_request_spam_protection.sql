begin;

-- Both public RPC families insert here, including pet and promo bookings.
-- Counters serialize concurrent requests across branches and both workflows.
-- Failed transactions roll back counters; successful retries of an order key
-- return before insertion and do not consume another allowance.
create function public.guard_public_request_insert()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare phone_key text; rate text; n integer; bucket timestamptz:=date_trunc('hour',now());
begin
 phone_key:=public.normalize_phone(new.phone);
 if phone_key is null or phone_key !~ '^\+?[0-9]{7,15}$' then
  raise exception 'Invalid contact number' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('public-contact:'||new.organization_id::text||':'||phone_key,0));
 foreach rate in array array[
  'public-contact:'||new.organization_id::text||':'||encode(digest(phone_key,'sha256'),'hex'),
  'public-business:'||new.organization_id::text
 ] loop
  insert into public.public_booking_rate_limits(key_hash,window_started_at,request_count)
  values(rate,bucket,1) on conflict(key_hash,window_started_at)
  do update set request_count=public.public_booking_rate_limits.request_count+1
  returning request_count into n;
  if n > (case when rate like 'public-business:%' then 100 else 5 end) then
   raise exception 'Too many public requests' using errcode='54000';
  end if;
 end loop;
 if tg_table_name='public_product_orders' then
  if exists(select 1 from public.public_product_orders r
   where r.organization_id=new.organization_id and r.phone_normalized=phone_key
    and r.product_id=new.product_id and r.status='requested'
    and r.created_at>now()-interval '15 minutes') then
   raise exception 'A similar request is already pending' using errcode='P0409';
  end if;
 else
  -- A new email, name, or service selection must not bypass the same-slot guard.
  -- Separate pets retain their own subject identity.
  if exists(select 1 from public.public_booking_requests r
   where r.organization_id=new.organization_id and r.phone_normalized=phone_key
    and r.branch_id=new.branch_id and r.preferred_at=new.preferred_at
    and r.subject_key is not distinct from new.subject_key and r.status='requested') then
   raise exception 'A similar request is already pending' using errcode='P0409';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_public_request_insert() from public,anon,authenticated;
create trigger public_product_orders_spam_guard before insert on public.public_product_orders
 for each row execute function public.guard_public_request_insert();
create trigger public_booking_requests_spam_guard before insert on public.public_booking_requests
 for each row execute function public.guard_public_request_insert();
create index public_product_orders_contact_recent on public.public_product_orders(organization_id,phone_normalized,product_id,created_at) where status='requested';
create index public_booking_requests_contact_slot on public.public_booking_requests(organization_id,phone_normalized,branch_id,preferred_at) where status='requested';
notify pgrst,'reload schema';
commit;
