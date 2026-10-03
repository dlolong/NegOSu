begin;
-- Explicit opt-in; existing products and internal inventory remain private.
alter table public.inventory_items add column is_public boolean not null default false;
create index inventory_items_public_catalog_idx on public.inventory_items(organization_id,branch_id,name,id)
 where is_public and is_active and product_purpose in ('retail','both');

create or replace function public.save_commerce_product(p_org uuid,p_branch uuid,p_id uuid,p_name text,p_sku text,p_description text,p_category text,p_unit text,p_price bigint,p_purpose text,p_tracked boolean,p_active boolean,p_request uuid,p_is_public boolean) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; receipt public.commerce_catalog_requests; payload jsonb;
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then raise exception 'Product management access required' using errcode='42501'; end if;
 if not exists(select 1 from public.organizations where id=p_org and industry in ('salon','automotive','pet_care','hospitality')) or not exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active) then raise exception 'Business or branch unavailable' using errcode='42501'; end if;
 if p_price is null or p_price not between 0 and 10000000000 or coalesce(length(trim(p_name)),0) not between 2 and 120 or coalesce(length(trim(p_unit)),0) not between 1 and 30 or length(coalesce(p_description,''))>1000 or length(coalesce(p_sku,''))>60 or length(coalesce(p_category,''))>80 or p_purpose is null or p_purpose not in ('retail','internal','both') or p_tracked is null or p_active is null then raise exception 'Invalid product details' using errcode='22023'; end if;
 if p_is_public and p_purpose='internal' then raise exception 'Internal supplies cannot be public' using errcode='22023'; end if;
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 payload:=jsonb_build_array(p_branch,p_id,p_name,p_sku,p_description,p_category,p_unit,p_price,p_purpose,p_tracked,p_active);
 if p_is_public is not null then payload:=payload||jsonb_build_array(p_is_public); end if;
 perform pg_advisory_xact_lock(hashtextextended('commerce-catalog:'||p_org::text||':'||p_request::text,0));
 select * into receipt from public.commerce_catalog_requests where organization_id=p_org and request_key=p_request;
 if receipt.result_id is not null then
  if receipt.operation<>'product' or receipt.payload is distinct from payload then raise exception 'Request key reused with different details' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 if p_id is null then
  insert into public.inventory_items(organization_id,branch_id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public)
  values(p_org,p_branch,trim(p_name),nullif(trim(p_sku),''),nullif(trim(p_description),''),nullif(trim(p_category),''),trim(p_unit),p_price,p_purpose,p_tracked,p_active,coalesce(p_is_public,false)) returning id into result;
 else
  update public.inventory_items set name=trim(p_name),sku=nullif(trim(p_sku),''),description=nullif(trim(p_description),''),category=nullif(trim(p_category),''),unit=trim(p_unit),sell_price_centavos=p_price,product_purpose=p_purpose,stock_tracked=p_tracked,is_active=p_active,is_public=case when p_purpose='internal' then false else coalesce(p_is_public,is_public) end
  where id=p_id and organization_id=p_org and branch_id=p_branch returning id into result;
  if result is null then raise exception 'Product unavailable' using errcode='42501'; end if;
 end if;
 insert into public.commerce_catalog_requests(organization_id,request_key,operation,payload,result_id) values(p_org,p_request,'product',payload,result);
 return result;
end $$;
revoke all on function public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid,boolean) from public,anon;
grant execute on function public.save_commerce_product(uuid,uuid,uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid,boolean) to authenticated;

-- Keep the previous signature and retry payload working for older callers.
create or replace function public.save_commerce_product(p_org uuid,p_branch uuid,p_id uuid,p_name text,p_sku text,p_description text,p_category text,p_unit text,p_price bigint,p_purpose text,p_tracked boolean,p_active boolean,p_request uuid) returns uuid
language sql security invoker set search_path=public,pg_temp as $$
 select public.save_commerce_product(p_org,p_branch,p_id,p_name,p_sku,p_description,p_category,p_unit,p_price,p_purpose,p_tracked,p_active,p_request,null::boolean)
$$;

-- Narrow public projection; no anonymous inventory table access is added.
CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('slug',o.slug,'currency',o.currency,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone,'description',b.public_description,'phone',b.phone,'email',b.email,'address',array[b.address_line,b.barangay,b.city,b.province,b.postal_code,b.country],'mapUrl',b.map_url,'hours',b.opening_hours,'acceptsBookings',b.accepts_public_bookings) order by b.is_primary desc,b.name) from public.branches b where b.organization_id=o.id and b.is_active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'thumbnailUrl',s.thumbnail_url,'currency',s.currency,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'priceCentavos',s.base_price_centavos,'category',c.name) order by c.sort_order,s.name) from public.services s left join public.service_categories c on c.id=s.category_id and c.organization_id=o.id where s.organization_id=o.id and s.is_active and s.is_public),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'category',p.category,'unit',p.unit,'priceCentavos',p.sell_price_centavos,'currency',o.currency,'branchId',b.id,'branchName',b.name) order by p.category nulls last,p.name,b.name,p.id)
 from public.inventory_items p join public.branches b on b.id=p.branch_id and b.organization_id=p.organization_id
 where p.organization_id=o.id and p.is_public and p.is_active and p.product_purpose in ('retail','both') and p.sell_price_centavos is not null and b.is_active),'[]'::jsonb),
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt_text) order by g.sort_order,g.created_at) from public.shop_gallery_images g where g.organization_id=o.id and g.is_active),'[]'::jsonb))
 from public.organizations o where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled
$function$;
notify pgrst,'reload schema';
commit;
