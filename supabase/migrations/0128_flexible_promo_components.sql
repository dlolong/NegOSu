begin;
-- Allow any nonempty combination of components supported by the business.
-- Keep tenant, branch, purpose, unit, quantity, public-booking and version checks.
create or replace function public.validate_commerce_promo() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare c jsonb; org public.organizations; item public.inventory_items; service public.services; billable integer:=0; keys text[]:='{}'; k text; q numeric;
begin
 if tg_op='UPDATE' and new.status='archived' and
  (new.organization_id,new.branch_id,new.name,new.description,new.price_centavos,new.currency,new.valid_from,new.valid_through,new.components)
  is not distinct from (old.organization_id,old.branch_id,old.name,old.description,old.price_centavos,old.currency,old.valid_from,old.valid_through,old.components) then
  new.version:=old.version+1; new.updated_at:=now(); return new;
 end if;
 select * into org from public.organizations where id=new.organization_id;
 if org.industry not in ('salon','automotive','pet_care','hospitality') or new.currency is distinct from org.currency then raise exception 'Invalid promo business or currency' using errcode='22023'; end if;
 if jsonb_typeof(new.components)<>'array' or jsonb_array_length(new.components) not between 1 and 30 then raise exception 'A promo needs between 1 and 30 components' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(new.components) loop
  if c->>'kind' is null or c->>'kind' not in ('service','accommodation','product','supply') or coalesce(c->>'quantity','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$' then raise exception 'Invalid promo component' using errcode='22023'; end if;
  q:=(c->>'quantity')::numeric;
  if q<=0 or nullif(trim(c->>'unit'),'') is null then raise exception 'Invalid component quantity or unit' using errcode='22023'; end if;
  k:=(case when c->>'kind' in ('product','supply') then 'inventory' else c->>'kind' end)||':'||coalesce(((c->>'referenceId')::uuid)::text,'');
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
 if new.is_public and org.industry<>'hospitality' and billable>10 then raise exception 'Public booking supports up to 10 services per promo' using errcode='22023'; end if;
 if tg_op='UPDATE' then
  if (new.organization_id,new.branch_id) is distinct from (old.organization_id,old.branch_id) then raise exception 'Promo ownership cannot change' using errcode='22023'; end if;
  new.version:=old.version+1;
 end if;
 new.updated_at:=now(); return new;
end $$;


notify pgrst,'reload schema';
commit;
