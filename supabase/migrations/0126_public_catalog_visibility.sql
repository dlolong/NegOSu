-- Narrow visibility mutation: do not overwrite catalog details from a stale form.
create function public.set_public_catalog_visibility(p_org uuid,p_branch uuid,p_kind text,p_id uuid,p_visible boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_org_role(p_org,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(p_org,p_branch) then
  raise exception 'Settings access required' using errcode='42501';
 end if;
 if p_visible is null then raise exception 'Visibility required' using errcode='22023'; end if;
 if p_kind='product' then
  update public.inventory_items set is_public=p_visible
   where id=p_id and organization_id=p_org and branch_id=p_branch and is_active
    and product_purpose in ('retail','both') and sell_price_centavos is not null
    and exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active);
 elsif p_kind='promo' then
  update public.commerce_promos set is_public=p_visible
   where id=p_id and organization_id=p_org and branch_id=p_branch and status='active'
    and exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active)
    and exists(select 1 from public.organizations where id=p_org and industry<>'hospitality');
 else raise exception 'Invalid catalog kind' using errcode='22023';
 end if;
 if not found then raise exception 'Item unavailable' using errcode='P0002'; end if;
end $$;
revoke all on function public.set_public_catalog_visibility(uuid,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.set_public_catalog_visibility(uuid,uuid,text,uuid,boolean) to authenticated;
