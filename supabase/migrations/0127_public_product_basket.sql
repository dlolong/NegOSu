begin;
alter table public.public_product_orders add column cart_payload jsonb;
create table public.public_product_order_lines (
 order_id uuid not null references public.public_product_orders(id) on delete cascade,
 product_id uuid not null references public.inventory_items(id),
 product_name text not null, unit text not null,
 quantity numeric(14,3) not null check(quantity>0 and quantity<=1000),
 unit_price_centavos bigint not null check(unit_price_centavos between 0 and 10000000000),
 primary key(order_id,product_id)
);
alter table public.public_product_order_lines enable row level security;
revoke all on public.public_product_order_lines from public,anon,authenticated;
grant select on public.public_product_order_lines to authenticated;
create policy public_product_order_lines_read on public.public_product_order_lines for select to authenticated
 using(exists(select 1 from public.public_product_orders o where o.id=order_id));

create function public.submit_public_product_basket(p_slug text,p_lines jsonb,p_request uuid,p_name text,p_phone text,p_email text,p_note text,p_rate_key text,p_honeypot text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare org public.organizations; product public.inventory_items; existing public.public_product_orders;
 item jsonb; first_item jsonb; canonical jsonb; payload jsonb; branch uuid; total numeric:=0; result jsonb;
begin
 if p_request is null or jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Invalid basket' using errcode='22023'; end if;
 if jsonb_array_length(p_lines) not between 1 and 20 then raise exception 'Choose 1 to 20 products' using errcode='22023'; end if;
 select * into org from public.organizations where slug=lower(trim(p_slug)) and status='active' and public_page_enabled;
 if org.id is null then raise exception 'Shop unavailable' using errcode='22023'; end if;
 select jsonb_agg(value order by value->>'productId') into canonical from jsonb_array_elements(p_lines);
 if (select count(distinct value->>'productId') from jsonb_array_elements(canonical))<>jsonb_array_length(canonical) then raise exception 'Duplicate products' using errcode='22023'; end if;
 payload:=jsonb_build_array(org.id,canonical,trim(p_name),trim(p_phone),lower(nullif(trim(p_email),'')),nullif(trim(p_note),''));
 perform pg_advisory_xact_lock(hashtextextended('public-product-order:'||p_request::text,0));
 select * into existing from public.public_product_orders where id=p_request;
 if found then
  if existing.cart_payload is distinct from payload then raise exception 'Retry content changed' using errcode='22023'; end if;
  return jsonb_build_object('reference',existing.id);
 end if;
 for item in select value from jsonb_array_elements(canonical) loop
  if coalesce(item->>'quantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$' or (item->>'quantity')::numeric not between 0.001 and 1000
   or coalesce(item->>'expectedPrice','') !~ '^[0-9]+$' or item->>'expectedCurrency' is null or item->>'expectedUnit' is null
  then raise exception 'Invalid basket item' using errcode='22023'; end if;
  select * into product from public.inventory_items where id=(item->>'productId')::uuid and organization_id=org.id and is_active and is_public and product_purpose in ('retail','both') and sell_price_centavos is not null for share;
  if product.id is null or not exists(select 1 from public.branches where id=product.branch_id and organization_id=org.id and is_active) then raise exception 'Product unavailable' using errcode='22023'; end if;
  if branch is null then branch:=product.branch_id; end if;
  if branch<>product.branch_id then raise exception 'Choose one pickup branch' using errcode='22023'; end if;
  if product.sell_price_centavos is distinct from (item->>'expectedPrice')::bigint or org.currency is distinct from item->>'expectedCurrency' or product.unit is distinct from item->>'expectedUnit' then raise exception 'Product price changed' using errcode='40001'; end if;
  total:=total+round((item->>'quantity')::numeric*product.sell_price_centavos);
 end loop;
 if total>1000000000000 then raise exception 'Order amount limit exceeded' using errcode='22023'; end if;
 first_item:=canonical->0;
 -- Reuse contact validation, rate limits and the contact serialization trigger.
 result:=public.submit_public_product_order(p_slug,(first_item->>'productId')::uuid,(first_item->>'quantity')::numeric,p_request,p_name,p_phone,p_email,p_note,p_rate_key,(first_item->>'expectedPrice')::bigint,first_item->>'expectedCurrency',first_item->>'expectedUnit',p_honeypot);
 if exists(select 1 from public.public_product_orders o where o.id<>p_request and o.organization_id=org.id and o.phone_normalized=public.normalize_phone(p_phone) and o.status='requested' and o.created_at>now()-interval '15 minutes'
 and (exists(select 1 from jsonb_array_elements(canonical) x where (x->>'productId')::uuid=o.product_id) or exists(select 1 from public.public_product_order_lines l join jsonb_array_elements(canonical) x on l.product_id=(x->>'productId')::uuid where l.order_id=o.id))) then raise exception 'A similar request is already pending' using errcode='P0409'; end if;
 insert into public.public_product_order_lines(order_id,product_id,product_name,unit,quantity,unit_price_centavos)
 select p_request,p.id,p.name,p.unit,(x->>'quantity')::numeric,p.sell_price_centavos from jsonb_array_elements(canonical) x join public.inventory_items p on p.id=(x->>'productId')::uuid and p.organization_id=org.id;
 update public.public_product_orders set cart_payload=payload,product_name=(select string_agg(product_name,', ' order by product_name) from public.public_product_order_lines where order_id=p_request) where id=p_request;
 return result;
end $$;
revoke all on function public.submit_public_product_basket(text,jsonb,uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_public_product_basket(text,jsonb,uuid,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.resolve_public_product_order(p_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_product_orders; product public.inventory_items; customer uuid; c uuid; line uuid; item record;
begin
 select * into r from public.public_product_orders where id=p_id for update;
 if auth.uid() is null or r.id is null or not public.has_org_role(r.organization_id,array['owner','manager','cashier']::public.organization_role[])
 or not public.can_access_branch(r.organization_id,r.branch_id)
 or not exists(select 1 from public.organizations where id=r.organization_id and status='active')
 then raise exception 'Order unavailable' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','decline') then raise exception 'Invalid order action' using errcode='22023'; end if;
 if r.status='confirmed' and p_action='confirm' then return r.checkout_id; end if;
 if r.status='declined' and p_action='decline' then return null; end if;
 if r.status<>'requested' then raise exception 'Order already resolved' using errcode='22023'; end if;
 if p_action='decline' then
  update public.public_product_orders set status='declined',resolved_at=now(),resolved_by=auth.uid() where id=r.id;
  return null;
 end if;
 for item in select product_id,quantity,unit_price_centavos,unit from public.public_product_order_lines where order_id=r.id
 union all select r.product_id,r.quantity,r.unit_price_centavos,r.unit where r.cart_payload is null
 order by product_id loop
 select * into product from public.inventory_items where id=item.product_id and organization_id=r.organization_id and branch_id=r.branch_id for update;
 if product.id is null or not product.is_active or not product.is_public or product.product_purpose not in ('retail','both')
 or product.sell_price_centavos is distinct from item.unit_price_centavos or product.unit<>item.unit
 or r.currency<>(select currency from public.organizations where id=r.organization_id)
 then raise exception 'Product or price changed; contact the customer before taking a new order' using errcode='22023'; end if;
 end loop;
 -- Serialize contact matching; public submitters never gain access to CRM records.
 perform pg_advisory_xact_lock(hashtextextended('public-order-customer:'||r.organization_id::text||':'||r.phone_normalized,0));
 -- Match both name and phone. Never overwrite an existing customer's contact details.
 select id into customer from public.customers where organization_id=r.organization_id and not is_archived
 and phone_normalized=r.phone_normalized and lower(full_name)=lower(r.customer_name) order by created_at,id limit 1;
 if customer is null then
  insert into public.customers(organization_id,full_name,phone,email) values(r.organization_id,r.customer_name,r.phone,r.email) returning id into customer;
 end if;
 c:=public.open_checkout(r.branch_id,null,null,customer,gen_random_uuid());
 for item in select product_id,quantity from public.public_product_order_lines where order_id=r.id
 union all select r.product_id,r.quantity where r.cart_payload is null order by product_id loop
  line:=public.save_checkout_product(c,null,null,item.product_id,item.quantity,gen_random_uuid());
 end loop;
 perform public.finalize_checkout(c,gen_random_uuid());
 update public.public_product_orders set status='confirmed',checkout_id=c,resolved_at=now(),resolved_by=auth.uid() where id=r.id;
 return c;
end $$;

create or replace function public.guard_public_request_insert()
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
    and (r.product_id=new.product_id or exists(select 1 from public.public_product_order_lines l where l.order_id=r.id and l.product_id=new.product_id)) and r.status='requested'
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

notify pgrst,'reload schema';
commit;
