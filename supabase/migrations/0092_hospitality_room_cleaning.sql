-- Checkout blocks reuse until staff finish the matching cleaning cycle.
alter table public.hospitality_rooms
 add column cleaning_required boolean not null default false,
 add column cleaning_stay_id uuid,
 add column cleaned_at timestamptz,
 add column cleaned_by uuid references auth.users(id),
 add constraint hospitality_cleaning_stay_fk foreign key(organization_id,branch_id,cleaning_stay_id) references public.hospitality_stays(organization_id,branch_id,id) on delete restrict,
 add constraint hospitality_cleaning_cycle_check check(not cleaning_required or (cleaning_stay_id is not null and cleaned_at is null and cleaned_by is null));

-- The shared room lock serializes check-in, checkout and cleaning completion.
-- Enforce at the data boundary, including any future arrival entry point.
create function public.guard_hospitality_clean_room() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare dirty boolean;
begin
 if new.checked_out_at is null then
  select cleaning_required into dirty from public.hospitality_rooms where id=new.room_id and organization_id=new.organization_id and branch_id=new.branch_id for update;
  if dirty then raise exception 'Room is being cleaned; mark ready before check-in' using errcode='55000'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_hospitality_clean_room() from public,anon,authenticated;
create trigger hospitality_clean_room_guard before insert or update of room_id,checked_out_at on public.hospitality_stays for each row execute function public.guard_hospitality_clean_room();

create or replace function public.check_out_hospitality(p_org uuid,p_branch uuid,p_stay uuid,p_acknowledge_debt boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays; amount bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier']::public.organization_role[]);
 -- Lock order: room, stay, invoice. Same order as check-in and room edits.
 perform 1 from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 if s.checked_out_at is not null then return; end if;
 select i.balance_centavos into amount from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id where sb.stay_id=s.id and i.status<>'void' for update of i;
 if coalesce(amount,0)>0 and not coalesce(p_acknowledge_debt,false) then raise exception 'Acknowledge the outstanding balance before checkout' using errcode='22023'; end if;
 update public.hospitality_stays set checked_out_at=now(),checked_out_by=auth.uid() where id=s.id;
 update public.hospitality_rooms set cleaning_required=true,cleaning_stay_id=s.id,cleaned_at=null,cleaned_by=null where id=s.room_id;
 update public.hospitality_stay_bills set checkout_debt_acknowledged=coalesce(amount,0)>0 where stay_id=s.id;
end $$;



create function public.mark_hospitality_room_ready(p_org uuid,p_branch uuid,p_room uuid,p_cleaning_stay uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare room public.hospitality_rooms;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier','technician']::public.organization_role[]);
 select * into room from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if room.id is null then raise exception 'Room not found' using errcode='42501'; end if;
 if p_cleaning_stay is null or room.cleaning_stay_id is distinct from p_cleaning_stay then raise exception 'Cleaning cycle changed; refresh the room' using errcode='40001'; end if;
 if exists(select 1 from public.hospitality_stays where room_id=room.id and checked_out_at is null) then raise exception 'Room is occupied' using errcode='55000'; end if;
 if not room.cleaning_required then return; end if;
 update public.hospitality_rooms set cleaning_required=false,cleaned_at=now(),cleaned_by=auth.uid() where id=room.id;
end $$;
revoke all on function public.mark_hospitality_room_ready(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.mark_hospitality_room_ready(uuid,uuid,uuid,uuid) to authenticated;

-- Preserve existing view column order; new metadata is appended.
create or replace view public.hospitality_room_availability with(security_invoker=true) as
select r.id,r.organization_id,r.branch_id,r.name,r.room_type,r.description,r.capacity,r.is_active,r.created_by,r.created_at,r.updated_at,r.rates,r.rates_version,
 s.id as stay_id,s.planned_checkout_at,s.stay_period_label,s.occupants,
 case when s.id is not null then 'occupied' when not r.is_active then 'inactive' when r.cleaning_required then 'cleaning' else 'vacant' end as occupancy_status,
 r.cleaning_required,r.cleaning_stay_id,r.cleaned_at,r.cleaned_by
from public.hospitality_rooms r left join public.hospitality_stays s on s.room_id=r.id and s.checked_out_at is null;

create or replace function public.get_hospitality_workspace(p_org uuid,p_branch uuid,p_start date,p_end date,p_section text default 'stays',p_page integer default 1,p_mode text default 'report') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare finance boolean; inventory_access boolean; result jsonb; details jsonb; total_rows bigint; branch_ids uuid[]; offset_rows integer; financial jsonb;
begin
 if not public.hospitality_enabled(p_org) or not public.is_org_member(p_org) then raise exception 'Hospitality access denied' using errcode='42501'; end if;
 if p_mode not in('report','overview','payments','history') or p_section not in('stays','collections','outstanding','rooms','inventory','movements') or p_page is null or p_page not between 1 and 100000 or p_start is null or p_end is null or p_end<p_start or p_end-p_start>731 then raise exception 'Invalid report filters' using errcode='22023'; end if;
 if (p_mode in('overview','history') and p_section<>'stays') or (p_mode='payments' and p_section not in('stays','collections','outstanding')) then raise exception 'Invalid workspace section' using errcode='22023'; end if;
 if p_mode='report' then perform public.authorize_report_scope(p_org,p_start,p_end,p_branch,false); end if;
 finance:=p_mode<>'history' and public.has_org_role(p_org,array['owner','manager','advisor','cashier']::public.organization_role[]);
 inventory_access:=p_mode in('report','overview') and public.has_permission(p_org,'inventory.manage');
 if (p_mode='payments' or p_section in('collections','outstanding')) and not finance then raise exception 'Finance access required' using errcode='42501'; end if;
 if p_section in('inventory','movements') and not inventory_access then raise exception 'Inventory access required' using errcode='42501'; end if;
 if p_branch is not null and not exists(select 1 from public.branches where id=p_branch and organization_id=p_org and public.can_access_branch(p_org,id)) then raise exception 'Branch not found' using errcode='42501'; end if;
 select coalesce(array_agg(id),'{}') into branch_ids from public.branches where organization_id=p_org and (p_branch is null or id=p_branch) and public.can_access_branch(p_org,id);
 offset_rows:=(p_page-1)*50;
 select jsonb_build_object('occupied',count(*) filter(where is_active and exists(select 1 from public.hospitality_stays s where s.room_id=r.id and s.checked_out_at is null)),
 'cleaning',count(*) filter(where is_active and cleaning_required),
 'vacant',count(*) filter(where is_active and not cleaning_required and not exists(select 1 from public.hospitality_stays s where s.room_id=r.id and s.checked_out_at is null)),
 'inactive',count(*) filter(where not is_active)) into result from public.hospitality_rooms r where branch_id=any(branch_ids);
 select result||jsonb_build_object('checkIns',count(*) filter(where s.checked_in_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_in_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone),
 'checkOuts',count(*) filter(where s.checked_out_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_out_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone),
 'inHouse',count(*) filter(where s.checked_out_at is null)) into result from public.hospitality_stays s join public.branches b on b.id=s.branch_id where s.branch_id=any(branch_ids);
 if finance then
 select jsonb_build_object('charges',coalesce(sum(i.total_centavos),0),'paid',coalesce(sum(i.paid_centavos),0),'outstanding',coalesce(sum(i.balance_centavos),0),
 'checkedOutDebt',count(*) filter(where s.checked_out_at is not null and i.balance_centavos>0)) into financial
 from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id join public.hospitality_stays s on s.id=sb.stay_id where sb.branch_id=any(branch_ids) and i.status<>'void';
 select financial||jsonb_build_object('collected',coalesce(sum(p.amount_centavos),0)) into financial from public.payments p join public.hospitality_stay_bills sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id
 where p.branch_id=any(branch_ids) and p.status='paid' and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone;
 select financial||jsonb_build_object('methods',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into financial from (select p.method,sum(p.amount_centavos) amount from public.payments p join public.hospitality_stay_bills sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.status='paid' and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone group by p.method)x;
 result:=result||jsonb_build_object('finance',financial);
 end if;
 if inventory_access then
 select result||jsonb_build_object('lowStock',count(*) filter(where low_stock),'stockItems',count(*)) into result from public.inventory_stock where branch_id=any(branch_ids) and is_active;
 end if;
 if p_section='stays' then
 select count(*) into total_rows from public.hospitality_stays s join public.branches b on b.id=s.branch_id where s.branch_id=any(branch_ids) and (s.checked_out_at is null or s.checked_in_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_in_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone or s.checked_out_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_out_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (select s.id,s.branch_id,b.timezone,s.guest_name_snapshot guest,s.room_name_snapshot room,s.occupants,s.checked_in_at,s.checked_out_at,b.name branch from public.hospitality_stays s join public.branches b on b.id=s.branch_id where s.branch_id=any(branch_ids) and (s.checked_out_at is null or s.checked_in_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_in_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone or s.checked_out_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_out_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone) order by (s.checked_out_at is null) desc,s.checked_in_at desc,s.id limit 50 offset offset_rows)x;
 elsif p_section='outstanding' then
 select count(*) into total_rows from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id where sb.branch_id=any(branch_ids) and i.balance_centavos>0 and i.status<>'void';
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select s.id,b.name branch,s.guest_name_snapshot guest,s.room_name_snapshot room,s.checked_out_at,i.total_centavos charges,i.paid_centavos paid,i.balance_centavos balance from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id join public.hospitality_stays s on s.id=sb.stay_id join public.branches b on b.id=s.branch_id where sb.branch_id=any(branch_ids) and i.balance_centavos>0 and i.status<>'void' order by i.balance_centavos desc,s.id limit 50 offset offset_rows)x;
 elsif p_section='collections' then
 select count(*) into total_rows from public.payments p join public.hospitality_stay_bills sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select s.id,b.name branch,b.timezone,p.id payment_id,s.guest_name_snapshot guest,s.room_name_snapshot room,p.amount_centavos amount,p.method,p.status,p.reference,p.paid_at from public.payments p join public.hospitality_stay_bills sb on sb.invoice_id=p.invoice_id join public.hospitality_stays s on s.id=sb.stay_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone order by p.paid_at desc,p.id limit 50 offset offset_rows)x;
 elsif p_section='rooms' then
 select count(*) into total_rows from public.hospitality_rooms where branch_id=any(branch_ids);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select r.id,r.name room,r.room_type,r.capacity,b.name branch,case when not r.is_active then 'Inactive' when s.id is not null then 'Occupied' when r.cleaning_required then 'Cleaning' else 'Vacant' end status,s.id stay_id,s.guest_name_snapshot guest from public.hospitality_rooms r join public.branches b on b.id=r.branch_id left join public.hospitality_stays s on s.room_id=r.id and s.checked_out_at is null where r.branch_id=any(branch_ids) order by r.name,r.id limit 50 offset offset_rows)x;
 elsif p_section='inventory' then
 select count(*) into total_rows from public.inventory_stock where branch_id=any(branch_ids) and is_active;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select stock.id,stock.name,stock.unit,stock.quantity_on_hand,stock.reorder_level,stock.low_stock,b.name branch from public.inventory_stock stock join public.branches b on b.id=stock.branch_id where stock.branch_id=any(branch_ids) and stock.is_active order by stock.name,stock.id limit 50 offset offset_rows)x;
 elsif p_section='movements' then
 select count(*) into total_rows from public.inventory_movements m join public.branches b on b.id=m.branch_id where m.branch_id=any(branch_ids) and m.created_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and m.created_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select m.id,b.name branch,b.timezone,i.name,m.movement_type,m.quantity_delta,m.created_at from public.inventory_movements m join public.inventory_items i on i.id=m.inventory_item_id join public.branches b on b.id=m.branch_id where m.branch_id=any(branch_ids) and m.created_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and m.created_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone order by m.created_at desc,m.id limit 50 offset offset_rows)x;
 end if;
 return result||jsonb_build_object('rows',details,'rowCount',total_rows,'page',p_page);
end $$;
revoke all on function public.get_hospitality_workspace(uuid,uuid,date,date,text,integer,text) from public,anon;
grant execute on function public.get_hospitality_workspace(uuid,uuid,date,date,text,integer,text) to authenticated;

