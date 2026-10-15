-- Restore the product report reader when an earlier checkout rollout omitted it.
-- Read-only repair: no financial records, stock, or RLS policies are changed.
begin;
create or replace function public.get_checkout_product_report(p_branch uuid,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid; result jsonb;
begin
 select b.organization_id into org from public.branches b join public.organizations o on o.id=b.organization_id where b.id=p_branch and o.status='active';
 if auth.uid() is null or not public.has_org_role(org,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(org,p_branch) then raise exception 'Report access required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select jsonb_build_object(
  'sales',coalesce(sum(i.total_centavos) filter(where i.status<>'void'),0),
  'paid',coalesce(sum(i.paid_centavos) filter(where i.status<>'void'),0),
  'balance',coalesce(sum(i.balance_centavos) filter(where i.status<>'void'),0)) into result
 from public.checkout_invoices ci join public.checkouts c on c.id=ci.checkout_id join public.invoices i on i.id=ci.invoice_id where c.organization_id=org and c.branch_id=p_branch;
 return result||jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
  select l.inventory_item_id,l.name,l.unit,
   coalesce(sum(l.quantity) filter(where l.included_key is null and i.status<>'void'),0) sold,
   coalesce(sum(l.line_total_centavos) filter(where l.included_key is null and i.status<>'void'),0) sales,
   coalesce(sum(l.quantity) filter(where l.included_key is not null),0) included,
   sum(l.handed_over) handed_over,sum(l.returned) returned
  from public.checkout_lines l join public.checkouts c on c.id=l.checkout_id left join public.invoices i on i.id=l.invoice_id
  where c.organization_id=org and c.branch_id=p_branch and l.removed_at is null
  group by l.inventory_item_id,l.name,l.unit order by l.name,l.inventory_item_id,l.unit limit 50 offset (p_page-1)*50
 )x));
end $$;
revoke all on function public.get_checkout_product_report(uuid,integer) from public,anon;
grant execute on function public.get_checkout_product_report(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
