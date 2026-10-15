-- Opt-in public layouts. No billing or RLS changes; all styles are free for now.
begin;
alter table public.organizations
  add column public_page_style text not null default 'standard',
  add column public_hero_headline text check (char_length(public_hero_headline) <= 120),
  add column public_hero_eyebrow text check (char_length(public_hero_eyebrow) <= 60),
  add column public_hero_description text check (char_length(public_hero_description) <= 300),
  add column public_hero_position text not null default 'center' check (public_hero_position in ('center','left','right')),
  add constraint organizations_public_page_style_check check (
    public_page_style = 'standard'
    or (industry = 'salon' and public_page_style = 'elegant')
    or (industry = 'automotive' and public_page_style = 'precision')
    or (industry = 'hospitality' and public_page_style = 'retreat')
    or (industry = 'pet_care' and public_page_style = 'friendly')
  );
alter table public.organizations drop constraint organizations_public_page_theme_check;
alter table public.organizations add constraint organizations_public_page_theme_check
  check (public_page_theme in ('classic','blue','plum','teal','graphite','indigo','crimson'));

CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('slug',o.slug,'theme',o.public_page_theme,'pageStyle',o.public_page_style,'hero',jsonb_build_object('headline',o.public_hero_headline,'eyebrow',o.public_hero_eyebrow,'description',o.public_hero_description,'position',o.public_hero_position),'currency',o.currency,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
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
