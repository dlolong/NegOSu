-- Optional public service presentation; existing publication and RLS gates remain intact.
begin;
alter table public.services add column thumbnail_url text;
alter table public.services add constraint services_thumbnail_url_check check (
 thumbnail_url is null or (length(thumbnail_url)<=2048 and thumbnail_url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
);
CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('slug',o.slug,'currency',o.currency,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone,'description',b.public_description,'phone',b.phone,'email',b.email,'address',array[b.address_line,b.barangay,b.city,b.province,b.postal_code,b.country],'mapUrl',b.map_url,'hours',b.opening_hours,'acceptsBookings',b.accepts_public_bookings) order by b.is_primary desc,b.name) from public.branches b where b.organization_id=o.id and b.is_active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'thumbnailUrl',s.thumbnail_url,'currency',s.currency,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'priceCentavos',s.base_price_centavos,'category',c.name) order by c.sort_order,s.name) from public.services s left join public.service_categories c on c.id=s.category_id and c.organization_id=o.id where s.organization_id=o.id and s.is_active and s.is_public),'[]'::jsonb),
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt_text) order by g.sort_order,g.created_at) from public.shop_gallery_images g where g.organization_id=o.id and g.is_active),'[]'::jsonb))
 from public.organizations o where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled
$function$;
notify pgrst,'reload schema';
commit;
