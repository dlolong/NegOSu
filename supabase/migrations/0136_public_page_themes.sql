-- Themes are organization-wide branding, currently free on every plan.
-- Existing owner/manager RLS and publication checks remain authoritative.
begin;
alter table public.organizations
  add column public_page_theme text not null default 'classic'
  constraint organizations_public_page_theme_check
  check (public_page_theme in ('classic','blue','plum','teal','graphite','indigo'));

CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('slug',o.slug,'theme',o.public_page_theme,'currency',o.currency,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone,'description',b.public_description,'phone',b.phone,'email',b.email,'address',array[b.address_line,b.barangay,b.city,b.province,b.postal_code,b.country],'mapUrl',b.map_url,'hours',b.opening_hours,'acceptsBookings',b.accepts_public_bookings) order by b.is_primary desc,b.name) from public.branches b where b.organization_id=o.id and b.is_active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'thumbnailUrl',s.thumbnail_url,'currency',s.currency,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'priceCentavos',s.base_price_centavos,'category',c.name) order by c.sort_order,s.name) from public.services s left join public.service_categories c on c.id=s.category_id and c.organization_id=o.id where s.organization_id=o.id and s.is_active and s.is_public),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'thumbnailUrl',p.thumbnail_url,'name',p.name,'description',p.description,'category',p.category,'unit',p.unit,'priceCentavos',p.sell_price_centavos,'currency',o.currency,'branchId',b.id,'branchName',b.name) order by p.category nulls last,p.name,b.name,p.id)
 from public.inventory_items p join public.branches b on b.id=p.branch_id and b.organization_id=p.organization_id
 where p.organization_id=o.id and p.is_public and p.is_active and p.product_purpose in ('retail','both') and p.sell_price_centavos is not null and b.is_active),'[]'::jsonb),
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt_text) order by g.sort_order,g.created_at) from public.shop_gallery_images g where g.organization_id=o.id and g.is_active),'[]'::jsonb))
 from public.organizations o where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled
$function$;

revoke all on function public.get_public_shop(text) from public;
grant execute on function public.get_public_shop(text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
