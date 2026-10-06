begin;
-- Read-only, invoker-rights report: source RLS and explicit branch scope both apply.
create or replace function public.get_inventory_consumption_report(p_org uuid,p_branch uuid,p_start date,p_end date,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_org_role(p_org,array['owner','manager','viewer']::public.organization_role[]) then
  raise exception 'Report access required' using errcode='42501';
 end if;
 if p_branch is not null and (not public.can_access_branch(p_org,p_branch) or not exists(select 1 from public.branches where id=p_branch and organization_id=p_org)) then
  raise exception 'Branch access required' using errcode='42501';
 end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 or p_page is null or p_page not between 1 and 100000 then
  raise exception 'Invalid report range' using errcode='22023';
 end if;
 with items as (
  select i.id,i.name,b.name branch_name,i.unit,i.stock_tracked,
   coalesce(sum(m.quantity_delta) filter(where m.created_at < p_start::timestamp at time zone b.timezone),0) opening,
   coalesce(sum(m.quantity_delta) filter(where m.created_at >= p_start::timestamp at time zone b.timezone and m.movement_type in ('opening','purchase','return','transfer_in')),0) received,
   coalesce(sum(-m.quantity_delta) filter(where m.created_at >= p_start::timestamp at time zone b.timezone and m.movement_type in ('usage','consume')),0) consumed,
   coalesce(sum(-m.quantity_delta) filter(where m.created_at >= p_start::timestamp at time zone b.timezone and m.movement_type='waste'),0) waste,
   coalesce(sum(m.quantity_delta) filter(where m.created_at >= p_start::timestamp at time zone b.timezone and m.movement_type not in ('opening','purchase','return','transfer_in','usage','consume','waste')),0) other,
   coalesce(sum(m.quantity_delta),0) closing
  from public.inventory_items i
  join public.branches b on b.id=i.branch_id and b.organization_id=i.organization_id
  left join public.inventory_movements m on m.inventory_item_id=i.id and m.organization_id=i.organization_id and m.branch_id=i.branch_id
   and m.created_at < (p_end+1)::timestamp at time zone b.timezone
  where i.organization_id=p_org and (p_branch is null or i.branch_id=p_branch)
   and public.can_access_branch(i.organization_id,i.branch_id)
  group by i.id,i.name,b.name,b.timezone,i.unit,i.stock_tracked
 ), totals as (
  select unit,sum(opening) opening,sum(received) received,sum(consumed) consumed,sum(waste) waste,sum(other) other,sum(closing) closing
  from items where stock_tracked group by unit
 ), daily_usage as (
  select (m.created_at at time zone b.timezone)::date AS "day",i.unit,sum(-m.quantity_delta) consumed
  from public.inventory_movements m
  join public.inventory_items i on i.id=m.inventory_item_id and i.organization_id=m.organization_id and i.branch_id=m.branch_id
  join public.branches b on b.id=i.branch_id and b.organization_id=i.organization_id
  where i.organization_id=p_org and (p_branch is null or i.branch_id=p_branch)
   and public.can_access_branch(i.organization_id,i.branch_id) and i.stock_tracked
   and m.movement_type in ('usage','consume')
   and m.created_at >= p_start::timestamp at time zone b.timezone
   and m.created_at < (p_end+1)::timestamp at time zone b.timezone
  group by (m.created_at at time zone b.timezone)::date,i.unit
 ), daily as (
  select p_start+d.offset_day AS "day",t.unit,coalesce(u.consumed,0) consumed
  from generate_series(0,p_end-p_start) d(offset_day)
  cross join totals t
  left join daily_usage u on u."day"=p_start+d.offset_day and u.unit=t.unit
 ), paged as (
  select * from items order by name,id limit 50 offset (p_page-1)*50
 )
 select jsonb_build_object('count',(select count(*) from items),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d."day",d.unit) from daily d),'[]'::jsonb),
  'totals',coalesce((select jsonb_agg(to_jsonb(t) order by unit) from totals t),'[]'::jsonb),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by name,id) from paged r),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_inventory_consumption_report(uuid,uuid,date,date,integer) from public,anon;
grant execute on function public.get_inventory_consumption_report(uuid,uuid,date,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
