begin;

-- Preserve the original RPC for existing clients; filter before paginating.
create function public.client_product_history_filtered(p_customer uuid,p_offset integer default 0,p_query text default null,p_from timestamptz default null,p_to timestamptz default null)
returns table(id uuid,name text,quantity numeric,unit text,returned numeric,purchased_at timestamptz,branch_name text,payment_status text,promo_name text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
 select organization_id into org from public.customers where customers.id=p_customer;
 if auth.uid() is null or org is null or not public.is_org_member(org) then raise exception 'Access denied' using errcode='42501'; end if;
 return query select l.id,l.name,case when l.included_key is not null then l.handed_over else l.quantity end,l.unit,l.returned,coalesce(i.issued_at,h.handed_at,l.created_at),b.name,
 case when l.included_key is not null then 'Promo inclusion' else i.status::text end,l.promo_name
 from public.checkouts c join public.checkout_lines l on l.checkout_id=c.id
 join public.branches b on b.id=c.branch_id and b.organization_id=c.organization_id
 left join public.invoices i on i.id=l.invoice_id and i.organization_id=c.organization_id and i.branch_id=c.branch_id
 left join lateral (select min(o.created_at) as handed_at from public.checkout_operations o
 where o.organization_id=c.organization_id and o.payload->>0='fulfillment' and o.payload->>5='handover' and o.payload->>3=l.id::text) h on l.included_key is not null
 where c.organization_id=org and c.customer_id=p_customer and public.can_access_branch(org,c.branch_id)
 and l.removed_at is null and ((l.included_key is null and i.status in ('issued','partially_paid','paid')) or (l.included_key is not null and l.handed_over>0))
 and (nullif(trim(p_query),'') is null or strpos(lower(l.name),lower(left(trim(p_query),120)))>0)
 and (p_from is null or coalesce(i.issued_at,h.handed_at,l.created_at)>=p_from)
 and (p_to is null or coalesce(i.issued_at,h.handed_at,l.created_at)<p_to)
 order by coalesce(i.issued_at,h.handed_at,l.created_at) desc,l.id limit 21 offset greatest(0,least(coalesce(p_offset,0),1000000));
end $$;
revoke all on function public.client_product_history_filtered(uuid,integer,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.client_product_history_filtered(uuid,integer,text,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
