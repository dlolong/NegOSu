begin;

-- Repair installations that applied an earlier 0103 catalog definition before
-- the save RPCs and idempotency receipts were added. Keep all catalog/stock data.
-- Also safe after the complete 0103: replace function bodies and preserve receipts.
create table if not exists public.commerce_catalog_requests (
 organization_id uuid not null references public.organizations(id), request_key uuid not null,
 operation text not null, payload jsonb not null, result_id uuid not null,
 created_at timestamptz not null default now(), primary key(organization_id,request_key)
);
alter table public.commerce_catalog_requests enable row level security;
revoke all on public.commerce_catalog_requests from public,anon,authenticated;

create or replace function public.save_commerce_promo(p_org uuid,p_branch uuid,p_id uuid,p_version integer,p_name text,p_description text,p_price bigint,p_status text,p_from date,p_through date,p_components jsonb,p_request uuid) returns uuid
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

create or replace function public.save_commerce_product(p_org uuid,p_branch uuid,p_id uuid,p_name text,p_sku text,p_description text,p_category text,p_unit text,p_price bigint,p_purpose text,p_tracked boolean,p_active boolean,p_request uuid) returns uuid
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

-- Retire old public save overloads, if present, without deleting their history.
do $$ begin
 if to_regprocedure('public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean)') is not null then
  execute 'revoke execute on function public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean) from public,anon,authenticated';
 end if;
 if to_regprocedure('public.save_commerce_promo(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb)') is not null then
  execute 'revoke execute on function public.save_commerce_promo(uuid,uuid,uuid,integer,text,text,bigint,text,date,date,jsonb) from public,anon,authenticated';
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
