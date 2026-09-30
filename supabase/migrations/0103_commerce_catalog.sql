begin;

-- Catalog identity stays in Core Inventory. Stock continues to be ledger-derived.
alter table public.inventory_items add column stock_tracked boolean not null default true;
alter table public.inventory_items add column product_purpose text not null default 'both'
  check(product_purpose in ('retail','internal','both'));

create table public.commerce_promos (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 branch_id uuid not null, name text not null check(length(trim(name)) between 2 and 120),
 description text not null default '' check(length(description)<=1000),
 price_centavos bigint not null check(price_centavos between 0 and 10000000000),
 currency text not null, status text not null check(status in ('draft','active','archived')),
 valid_from date, valid_through date, version integer not null default 1 check(version>0),
 components jsonb not null, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 check(valid_through is null or valid_from is null or valid_through>=valid_from),
 unique(organization_id,branch_id,id)
);
alter table public.commerce_promos enable row level security;
revoke all on public.commerce_promos from public,anon,authenticated;
grant select on public.commerce_promos to authenticated;
create policy commerce_promos_read on public.commerce_promos for select to authenticated
 using(public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));

create function public.validate_commerce_promo() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare c jsonb; org public.organizations; item public.inventory_items; service public.services; billable integer:=0; keys text[]:='{}'; k text; q numeric;
begin
 if tg_op='UPDATE' and new.status='archived' and
  (new.organization_id,new.branch_id,new.name,new.description,new.price_centavos,new.currency,new.valid_from,new.valid_through,new.components)
  is not distinct from (old.organization_id,old.branch_id,old.name,old.description,old.price_centavos,old.currency,old.valid_from,old.valid_through,old.components) then
  new.version:=old.version+1; new.updated_at:=now(); return new;
 end if;
 select * into org from public.organizations where id=new.organization_id;
 if org.industry not in ('salon','automotive','pet_care','hospitality') or new.currency is distinct from org.currency then raise exception 'Invalid promo business or currency' using errcode='22023'; end if;
 if jsonb_typeof(new.components)<>'array' or jsonb_array_length(new.components) not between 2 and 30 then raise exception 'A promo needs a billable component and included products' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(new.components) loop
  if c->>'kind' is null or c->>'kind' not in ('service','accommodation','product','supply') or coalesce(c->>'quantity','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$' then raise exception 'Invalid promo component' using errcode='22023'; end if;
  q:=(c->>'quantity')::numeric;
  if q<=0 or nullif(trim(c->>'unit'),'') is null then raise exception 'Invalid component quantity or unit' using errcode='22023'; end if;
  k:=(c->>'kind')||':'||coalesce(c->>'referenceId','');
  if k=any(keys) then raise exception 'Duplicate promo component' using errcode='22023'; end if;
  keys:=array_append(keys,k);
  if c->>'kind' in ('service','accommodation') then
   billable:=billable+1;
   if q<>1 or c->>'unit'<>'service' then raise exception 'Billable components require one service unit' using errcode='22023'; end if;
   if c->>'kind'='accommodation' then
    if org.industry<>'hospitality' or c->>'referenceId' is not null then raise exception 'Accommodation requires a stay context' using errcode='22023'; end if;
   else
    select * into service from public.services where id=(c->>'referenceId')::uuid and organization_id=new.organization_id and is_active;
    if service.id is null or service.currency is distinct from org.currency or org.industry='hospitality' then raise exception 'Service unavailable' using errcode='22023'; end if;
   end if;
  else
   select * into item from public.inventory_items where id=(c->>'referenceId')::uuid and organization_id=new.organization_id and branch_id=new.branch_id and is_active;
   if item.id is null or item.unit is distinct from c->>'unit' then raise exception 'Product unavailable or unsupported unit conversion' using errcode='22023'; end if;
   if (c->>'kind'='product' and item.product_purpose='internal') or (c->>'kind'='supply' and item.product_purpose='retail') then raise exception 'Product purpose does not match component' using errcode='22023'; end if;
  end if;
 end loop;
 if billable<>1 then raise exception 'Choose exactly one service or accommodation component' using errcode='22023'; end if;
 if tg_op='UPDATE' then
  if (new.organization_id,new.branch_id) is distinct from (old.organization_id,old.branch_id) then raise exception 'Promo ownership cannot change' using errcode='22023'; end if;
  new.version:=old.version+1;
 end if;
 new.updated_at:=now(); return new;
end $$;
create trigger commerce_promo_validate before insert or update on public.commerce_promos for each row execute function public.validate_commerce_promo();
create trigger commerce_promo_audit after insert or update on public.commerce_promos for each row execute function public.audit_job_finance_change();

-- Mutation receipts are private; retries compare the entire submitted payload.
create table public.commerce_catalog_requests (
 organization_id uuid not null references public.organizations(id), request_key uuid not null,
 operation text not null, payload jsonb not null, result_id uuid not null,
 created_at timestamptz not null default now(), primary key(organization_id,request_key)
);
alter table public.commerce_catalog_requests enable row level security;
revoke all on public.commerce_catalog_requests from public,anon,authenticated;

create function public.save_commerce_promo(p_org uuid,p_branch uuid,p_id uuid,p_version integer,p_name text,p_description text,p_price bigint,p_status text,p_from date,p_through date,p_components jsonb,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; receipt public.commerce_catalog_requests; payload jsonb;
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then raise exception 'Promo management access required' using errcode='42501'; end if;
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 payload:=jsonb_build_array(p_branch,p_id,p_version,p_name,p_description,p_price,p_status,p_from,p_through,p_components);
 perform pg_advisory_xact_lock(hashtextextended('commerce-catalog:'||p_org::text||':'||p_request::text,0));
 select * into receipt from public.commerce_catalog_requests where organization_id=p_org and request_key=p_request;
 if receipt.result_id is not null then
  if receipt.operation<>'promo' or receipt.payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 if p_id is null then
  insert into public.commerce_promos(organization_id,branch_id,name,description,price_centavos,currency,status,valid_from,valid_through,components,created_by)
  values(p_org,p_branch,trim(p_name),coalesce(p_description,''),p_price,(select currency from public.organizations where id=p_org),p_status,p_from,p_through,p_components,auth.uid()) returning id into result;
 else
  update public.commerce_promos set name=trim(p_name),description=coalesce(p_description,''),price_centavos=p_price,status=p_status,valid_from=p_from,valid_through=p_through,components=p_components
   where id=p_id and organization_id=p_org and branch_id=p_branch and version=p_version returning id into result;
  if result is null then raise exception 'Promo changed or is unavailable; reload before saving' using errcode='40001'; end if;
 end if;
 insert into public.commerce_catalog_requests(organization_id,request_key,operation,payload,result_id) values(p_org,p_request,'promo',payload,result);
 return result;
end $$;
revoke all on function public.save_commerce_promo(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb,uuid) from public,anon;
grant execute on function public.save_commerce_promo(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb,uuid) to authenticated;

create function public.guard_commerce_product_units() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (new.unit,new.stock_tracked,new.branch_id,new.organization_id) is distinct from (old.unit,old.stock_tracked,old.branch_id,old.organization_id)
 and (exists(select 1 from public.inventory_movements where inventory_item_id=old.id) or exists(select 1 from public.inventory_reservations where inventory_item_id=old.id)) then
  raise exception 'Stock history exists; unit and stock identity cannot change' using errcode='22023';
 end if; return new;
end $$;
create trigger commerce_product_units before update on public.inventory_items for each row execute function public.guard_commerce_product_units();
create trigger commerce_product_audit after insert or update on public.inventory_items for each row execute function public.audit_job_finance_change();

create function public.guard_nonstock_movement() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare tracked boolean;
begin
 select stock_tracked into tracked from public.inventory_items where id=new.inventory_item_id for update;
 if tracked=false then
  raise exception 'Non-stock products cannot have physical stock movements' using errcode='22023';
 end if; return new;
end $$;
create trigger commerce_nonstock_movement before insert on public.inventory_movements for each row execute function public.guard_nonstock_movement();

create function public.save_commerce_product(p_org uuid,p_branch uuid,p_id uuid,p_name text,p_sku text,p_description text,p_category text,p_unit text,p_price bigint,p_purpose text,p_tracked boolean,p_active boolean,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; receipt public.commerce_catalog_requests; payload jsonb;
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then raise exception 'Product management access required' using errcode='42501'; end if;
 if not exists(select 1 from public.organizations where id=p_org and industry in ('salon','automotive','pet_care','hospitality')) or not exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active) then raise exception 'Business or branch unavailable' using errcode='42501'; end if;
 if p_price is null or p_price not between 0 and 10000000000 or coalesce(length(trim(p_name)),0) not between 2 and 120 or coalesce(length(trim(p_unit)),0) not between 1 and 30 or length(coalesce(p_description,''))>1000 or length(coalesce(p_sku,''))>60 or length(coalesce(p_category,''))>80 or p_purpose is null or p_purpose not in ('retail','internal','both') or p_tracked is null or p_active is null then raise exception 'Invalid product details' using errcode='22023'; end if;
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 payload:=jsonb_build_array(p_branch,p_id,p_name,p_sku,p_description,p_category,p_unit,p_price,p_purpose,p_tracked,p_active);
 perform pg_advisory_xact_lock(hashtextextended('commerce-catalog:'||p_org::text||':'||p_request::text,0));
 select * into receipt from public.commerce_catalog_requests where organization_id=p_org and request_key=p_request;
 if receipt.result_id is not null then
  if receipt.operation<>'product' or receipt.payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 if p_id is null then
  insert into public.inventory_items(organization_id,branch_id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active)
  values(p_org,p_branch,trim(p_name),nullif(trim(p_sku),''),nullif(trim(p_description),''),nullif(trim(p_category),''),trim(p_unit),p_price,p_purpose,p_tracked,p_active) returning id into result;
 else
  update public.inventory_items set name=trim(p_name),sku=nullif(trim(p_sku),''),description=nullif(trim(p_description),''),category=nullif(trim(p_category),''),unit=trim(p_unit),sell_price_centavos=p_price,product_purpose=p_purpose,stock_tracked=p_tracked,is_active=p_active
  where id=p_id and organization_id=p_org and branch_id=p_branch returning id into result;
  if result is null then raise exception 'Product unavailable' using errcode='42501'; end if;
 end if;
 insert into public.commerce_catalog_requests(organization_id,request_key,operation,payload,result_id) values(p_org,p_request,'product',payload,result);
 return result;
end $$;
revoke all on function public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid) from public,anon;
grant execute on function public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
