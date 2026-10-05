begin;

-- Public submissions are requests, not paid sales or inventory reservations.
create table public.public_product_orders (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 branch_id uuid not null,
 product_id uuid not null references public.inventory_items(id),
 product_name text not null,
 unit text not null,
 quantity numeric(14,3) not null check(quantity>0 and quantity<=1000),
 unit_price_centavos bigint not null check(unit_price_centavos between 0 and 10000000000),
 currency text not null,
 customer_name text not null check(char_length(customer_name) between 2 and 120),
 phone text not null check(char_length(phone) between 7 and 30),
 phone_normalized text not null,
 email text,
 note text check(char_length(note)<=1000),
 request_payload jsonb not null,
 status text not null default 'requested' check(status in ('requested','confirmed','declined')),
 checkout_id uuid unique references public.checkouts(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references auth.users(id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 check((status='confirmed')=(checkout_id is not null)),
 check((status='requested')=(resolved_at is null)),
 check((resolved_at is null)=(resolved_by is null))
);
create index public_product_orders_attention on public.public_product_orders(organization_id,branch_id,status,created_at,id);
alter table public.public_product_orders enable row level security;
revoke all on public.public_product_orders from public,anon,authenticated;
grant select on public.public_product_orders to authenticated;
create policy public_product_orders_read on public.public_product_orders for select to authenticated using(
 public.has_org_role(organization_id,array['owner','manager','cashier']::public.organization_role[]) and public.can_access_branch(organization_id,branch_id)
);

create function public.submit_public_product_order(p_slug text,p_product uuid,p_quantity numeric,p_request uuid,p_name text,p_phone text,p_email text,p_note text,p_rate_key text,p_expected_price bigint,p_expected_currency text,p_expected_unit text,p_honeypot text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare org public.organizations; product public.inventory_items; existing public.public_product_orders;
 payload jsonb; phone_key text; bucket timestamptz:=date_trunc('hour',now()); n integer; rate text;
begin
 if p_request is null or p_quantity is null or p_quantity<=0 or p_quantity>1000 or p_quantity<>round(p_quantity,3)
 or p_expected_price is null or p_expected_price not between 0 and 10000000000 or p_expected_currency is null or p_expected_unit is null
 or coalesce(length(trim(p_name)),0) not between 2 and 120 or coalesce(length(trim(p_phone)),0) not between 7 and 30
 or length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')) not between 7 and 15
 or length(coalesce(p_email,''))>254 or (nullif(trim(p_email),'') is not null and p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 or length(coalesce(p_note,''))>1000 or coalesce(p_honeypot,'')<>'' or coalesce(p_rate_key,'') !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid order details' using errcode='22023'; end if;
 select * into org from public.organizations where slug=lower(trim(p_slug)) and status='active' and public_page_enabled;
 if org.id is null then raise exception 'Product unavailable' using errcode='22023'; end if;
 phone_key:=public.normalize_phone(p_phone);
 payload:=jsonb_build_array(org.id,p_product,p_quantity,trim(p_name),trim(p_phone),lower(nullif(trim(p_email),'')),nullif(trim(p_note),''),p_expected_price,p_expected_currency,p_expected_unit);
 perform pg_advisory_xact_lock(hashtextextended('public-product-order:'||p_request::text,0));
 select * into existing from public.public_product_orders where id=p_request;
 if found then
  if existing.request_payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return jsonb_build_object('reference',existing.id);
 end if;
 select * into product from public.inventory_items where id=p_product and organization_id=org.id and is_active and is_public and product_purpose in ('retail','both') and sell_price_centavos is not null for share;
 if product.id is null or not exists(select 1 from public.branches where id=product.branch_id and organization_id=org.id and is_active)
 then raise exception 'Product unavailable' using errcode='22023'; end if;
 if product.sell_price_centavos<>p_expected_price or org.currency<>p_expected_currency or product.unit<>p_expected_unit then raise exception 'Product price changed' using errcode='40001'; end if;
 if round(p_quantity*product.sell_price_centavos)>1000000000000 then raise exception 'Order amount limit exceeded' using errcode='22023'; end if;
 -- Phone and organization caps also apply to callers who bypass the server action.
 foreach rate in array array['product-ip:'||org.id::text||':'||p_rate_key,'product-phone:'||org.id::text||':'||encode(digest(phone_key,'sha256'),'hex'),'product-org:'||org.id::text] loop
  insert into public.public_booking_rate_limits(key_hash,window_started_at,request_count) values(rate,bucket,1)
  on conflict(key_hash,window_started_at) do update set request_count=public.public_booking_rate_limits.request_count+1 returning request_count into n;
  if n > (case when rate like 'product-org:%' then 100 else 5 end) then
   raise exception 'Too many order requests' using errcode='54000';
  end if;
 end loop;
 insert into public.public_product_orders(id,organization_id,branch_id,product_id,product_name,unit,quantity,unit_price_centavos,currency,customer_name,phone,phone_normalized,email,note,request_payload)
 values(p_request,org.id,product.branch_id,product.id,product.name,product.unit,p_quantity,product.sell_price_centavos,org.currency,trim(p_name),trim(p_phone),phone_key,lower(nullif(trim(p_email),'')),nullif(trim(p_note),''),payload);
 return jsonb_build_object('reference',p_request);
end $$;

create function public.resolve_public_product_order(p_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_product_orders; product public.inventory_items; customer uuid; c uuid; line uuid;
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
 select * into product from public.inventory_items where id=r.product_id and organization_id=r.organization_id and branch_id=r.branch_id for update;
 if product.id is null or not product.is_active or not product.is_public or product.product_purpose not in ('retail','both')
 or product.sell_price_centavos is distinct from r.unit_price_centavos or product.unit<>r.unit
 or r.currency<>(select currency from public.organizations where id=r.organization_id)
 then raise exception 'Product or price changed; contact the customer before taking a new order' using errcode='22023'; end if;
 -- Serialize contact matching; public submitters never gain access to CRM records.
 perform pg_advisory_xact_lock(hashtextextended('public-order-customer:'||r.organization_id::text||':'||r.phone_normalized,0));
 -- Match both name and phone. Never overwrite an existing customer's contact details.
 select id into customer from public.customers where organization_id=r.organization_id and not is_archived
 and phone_normalized=r.phone_normalized and lower(full_name)=lower(r.customer_name) order by created_at,id limit 1;
 if customer is null then
  insert into public.customers(organization_id,full_name,phone,email) values(r.organization_id,r.customer_name,r.phone,r.email) returning id into customer;
 end if;
 c:=public.open_checkout(r.branch_id,null,null,customer,gen_random_uuid());
 line:=public.save_checkout_product(c,null,null,r.product_id,r.quantity,gen_random_uuid());
 perform public.finalize_checkout(c,gen_random_uuid());
 update public.public_product_orders set status='confirmed',checkout_id=c,resolved_at=now(),resolved_by=auth.uid() where id=r.id;
 return c;
end $$;
revoke all on function public.submit_public_product_order(text,uuid,numeric,uuid,text,text,text,text,text,bigint,text,text,text),public.resolve_public_product_order(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_public_product_order(text,uuid,numeric,uuid,text,text,text,text,text,bigint,text,text,text) to anon,authenticated;
grant execute on function public.resolve_public_product_order(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
