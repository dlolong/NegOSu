begin;
-- Vertical policies consume the composed balance without moving operational state into Core.
create function public.guard_job_checkout_balance() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; due bigint;
begin
 if new.status='completed' and old.status is distinct from new.status then
  select checkout.* into c from public.checkouts checkout join public.invoices i on i.id=checkout.source_invoice_id where i.job_order_id=new.id;
  if c.id is not null then
   perform 1 from public.invoices where id=c.source_invoice_id for update;
   select coalesce(sum(i.balance_centavos),0) into due from public.checkout_invoices ci join public.invoices i on i.id=ci.invoice_id where ci.checkout_id=c.id and i.status<>'void';
   if due>0 or exists(select 1 from public.checkout_lines where checkout_id=c.id and invoice_id is null and included_key is null and removed_at is null) then raise exception 'Complete checkout payment before releasing the vehicle' using errcode='22023'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger job_checkout_balance before update of status on public.job_orders for each row execute function public.guard_job_checkout_balance();
revoke all on function public.guard_job_checkout_balance() from public,anon,authenticated;
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
 select coalesce(amount,0)+coalesce((select sum(i.balance_centavos) from public.checkouts c join public.checkout_invoices ci on ci.checkout_id=c.id join public.invoices i on i.id=ci.invoice_id join public.hospitality_stay_bills sb on sb.invoice_id=c.source_invoice_id where sb.stay_id=s.id and i.status<>'void'),0) into amount;
 if exists(select 1 from public.checkouts c join public.hospitality_stay_bills sb on sb.invoice_id=c.source_invoice_id join public.checkout_lines l on l.checkout_id=c.id where sb.stay_id=s.id and l.invoice_id is null and l.included_key is null and l.removed_at is null) then raise exception 'Finalize product checkout before room checkout' using errcode='22023'; end if;
 if coalesce(amount,0)>0 and not coalesce(p_acknowledge_debt,false) then raise exception 'Acknowledge the outstanding balance before checkout' using errcode='22023'; end if;
 if exists(select 1 from public.invoice_deposits d join public.hospitality_stay_bills sb on sb.invoice_id=d.invoice_id where sb.stay_id=s.id and d.refunded_at is null) then raise exception 'Return the refundable deposit before checkout' using errcode='22023'; end if;
 update public.hospitality_stays set checked_out_at=now(),checked_out_by=auth.uid() where id=s.id;
 update public.hospitality_rooms set cleaning_required=true,cleaning_stay_id=s.id,cleaned_at=null,cleaned_by=null where id=s.room_id;
 update public.hospitality_stay_bills set checkout_debt_acknowledged=coalesce(amount,0)>0 where stay_id=s.id;
end $$;

create view public.hospitality_financial_documents with(security_invoker=true) as
 select organization_id,branch_id,stay_id,invoice_id from public.hospitality_stay_bills
 union all
 select c.organization_id,c.branch_id,sb.stay_id,ci.invoice_id
 from public.checkout_invoices ci join public.checkouts c on c.id=ci.checkout_id
 join public.organizations o on o.id=c.organization_id and o.industry='hospitality'
 left join public.hospitality_stay_bills sb on sb.invoice_id=c.source_invoice_id
 where public.has_org_role(c.organization_id,array['owner','manager','cashier']::public.organization_role[]);
revoke all on public.hospitality_financial_documents from public,anon;
grant select on public.hospitality_financial_documents to authenticated;
-- Deposits are separate liabilities, never included in accommodation collections.
create or replace function public.get_hospitality_workspace(p_org uuid,p_branch uuid,p_start date,p_end date,p_section text default 'stays',p_page integer default 1,p_mode text default 'report') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare finance boolean; inventory_access boolean; result jsonb; details jsonb; total_rows bigint; branch_ids uuid[]; offset_rows integer; financial jsonb;
begin
 if not public.hospitality_enabled(p_org) or not public.is_org_member(p_org) then raise exception 'Hospitality access denied' using errcode='42501'; end if;
 if p_mode not in('report','overview','payments','history') or p_section not in('stays','collections','outstanding','deposits','rooms','inventory','movements') or p_page is null or p_page not between 1 and 100000 or p_start is null or p_end is null or p_end<p_start or p_end-p_start>731 then raise exception 'Invalid report filters' using errcode='22023'; end if;
 if (p_mode in('overview','history') and p_section<>'stays') or (p_mode='payments' and p_section not in('stays','collections','outstanding','deposits')) then raise exception 'Invalid workspace section' using errcode='22023'; end if;
 if p_mode='report' then perform public.authorize_report_scope(p_org,p_start,p_end,p_branch,false); end if;
 finance:=p_mode<>'history' and public.has_org_role(p_org,array['owner','manager','advisor','cashier']::public.organization_role[]);
 inventory_access:=p_mode in('report','overview') and public.has_permission(p_org,'inventory.manage');
 if (p_mode='payments' or p_section in('collections','outstanding','deposits')) and not finance then raise exception 'Finance access required' using errcode='42501'; end if;
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
 from public.hospitality_financial_documents sb join public.invoices i on i.id=sb.invoice_id left join public.hospitality_stays s on s.id=sb.stay_id where sb.branch_id=any(branch_ids) and i.status<>'void';
 select financial||jsonb_build_object('collected',coalesce(sum(p.amount_centavos),0)) into financial from public.payments p join public.hospitality_financial_documents sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id
 where p.branch_id=any(branch_ids) and p.status='paid' and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone;
 select financial||jsonb_build_object('methods',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into financial from (select p.method,sum(p.amount_centavos) amount from public.payments p join public.hospitality_financial_documents sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.status='paid' and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone group by p.method)x;
 select financial||jsonb_build_object('depositsHeld',coalesce(sum(d.amount_centavos) filter(where d.refunded_at is null),0),
 'depositsReceived',coalesce(sum(d.amount_centavos) filter(where (d.received_at at time zone b.timezone)::date between p_start and p_end),0),
 'depositsReturned',coalesce(sum(d.amount_centavos) filter(where (d.refunded_at at time zone b.timezone)::date between p_start and p_end),0)) into financial
 from public.invoice_deposits d join public.hospitality_stay_bills sb on sb.invoice_id=d.invoice_id join public.branches b on b.id=d.branch_id where d.branch_id=any(branch_ids);
 result:=result||jsonb_build_object('finance',financial);
 end if;
 if inventory_access then
 select result||jsonb_build_object('lowStock',count(*) filter(where low_stock),'stockItems',count(*)) into result from public.inventory_stock where branch_id=any(branch_ids) and is_active;
 end if;
 if p_section='stays' then
 select count(*) into total_rows from public.hospitality_stays s join public.branches b on b.id=s.branch_id where s.branch_id=any(branch_ids) and (s.checked_out_at is null or s.checked_in_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_in_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone or s.checked_out_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_out_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (select s.id,s.branch_id,b.timezone,s.guest_name_snapshot guest,s.room_name_snapshot room,s.occupants,s.checked_in_at,s.checked_out_at,b.name branch from public.hospitality_stays s join public.branches b on b.id=s.branch_id where s.branch_id=any(branch_ids) and (s.checked_out_at is null or s.checked_in_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_in_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone or s.checked_out_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and s.checked_out_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone) order by (s.checked_out_at is null) desc,s.checked_in_at desc,s.id limit 50 offset offset_rows)x;
 elsif p_section='outstanding' then
 select count(*) into total_rows from public.hospitality_financial_documents sb join public.invoices i on i.id=sb.invoice_id where sb.branch_id=any(branch_ids) and i.balance_centavos>0 and i.status<>'void';
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select coalesce(s.id,i.id) id,i.id invoice_id,b.name branch,coalesce(s.guest_name_snapshot,'Product customer') guest,coalesce(s.room_name_snapshot,'Product sale') room,s.checked_out_at,i.total_centavos charges,i.paid_centavos paid,i.balance_centavos balance from public.hospitality_financial_documents sb join public.invoices i on i.id=sb.invoice_id left join public.hospitality_stays s on s.id=sb.stay_id join public.branches b on b.id=sb.branch_id where sb.branch_id=any(branch_ids) and i.balance_centavos>0 and i.status<>'void' order by i.balance_centavos desc,s.id limit 50 offset offset_rows)x;
 elsif p_section='deposits' then
 select count(*) into total_rows from public.invoice_deposits d join public.hospitality_stay_bills sb on sb.invoice_id=d.invoice_id join public.branches b on b.id=d.branch_id where d.branch_id=any(branch_ids) and (d.refunded_at is null or (d.received_at at time zone b.timezone)::date between p_start and p_end or (d.refunded_at at time zone b.timezone)::date between p_start and p_end);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select s.id,d.id deposit_id,b.name branch,b.timezone,s.room_name_snapshot room,d.amount_centavos amount,d.method,d.received_at,d.refunded_at,case when d.refunded_at is null then 'Held' else 'Returned' end status from public.invoice_deposits d join public.hospitality_stay_bills sb on sb.invoice_id=d.invoice_id join public.hospitality_stays s on s.id=sb.stay_id join public.branches b on b.id=d.branch_id where d.branch_id=any(branch_ids) and (d.refunded_at is null or (d.received_at at time zone b.timezone)::date between p_start and p_end or (d.refunded_at at time zone b.timezone)::date between p_start and p_end) order by (d.refunded_at is null) desc,d.received_at desc,d.id limit 50 offset offset_rows)x;
 elsif p_section='collections' then
 select count(*) into total_rows from public.payments p join public.hospitality_financial_documents sb on sb.invoice_id=p.invoice_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from(select coalesce(s.id,p.invoice_id) id,p.invoice_id,b.name branch,b.timezone,p.id payment_id,coalesce(s.guest_name_snapshot,'Product customer') guest,coalesce(s.room_name_snapshot,'Product sale') room,p.amount_centavos amount,p.method,p.status,p.reference,p.receipt_number,p.paid_at from public.payments p join public.hospitality_financial_documents sb on sb.invoice_id=p.invoice_id left join public.hospitality_stays s on s.id=sb.stay_id join public.branches b on b.id=p.branch_id where p.branch_id=any(branch_ids) and p.paid_at>=(case when p_mode='overview' then (now() at time zone b.timezone)::date else p_start end)::timestamp at time zone b.timezone and p.paid_at<((case when p_mode='overview' then (now() at time zone b.timezone)::date else p_end end)+1)::timestamp at time zone b.timezone order by p.paid_at desc,p.id limit 50 offset offset_rows)x;
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

-- Reconcile product bills into existing reports without counting included promo products twice.
create or replace function public.get_appointment_report(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; advanced boolean;
begin
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>731 then raise exception 'Invalid reporting range' using errcode='22023'; end if;
 advanced:=public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id);
 with branches as (
  select b.id,b.name,b.timezone from public.branches b where b.organization_id=p_organization_id and (p_branch_id is null or b.id=p_branch_id) and public.can_access_branch(p_organization_id,b.id)
 ), product_bills as (
  select i.*,(i.issued_at at time zone b.timezone)::date report_day from public.checkout_invoices ci join public.invoices i on i.id=ci.invoice_id join branches b on b.id=i.branch_id
  where i.organization_id=p_organization_id and i.status<>'void' and (i.issued_at at time zone b.timezone)::date between p_start_date and p_end_date
 ), all_visits as (
  select a.*,(a.starts_at at time zone b.timezone)::date report_day from public.appointments a join branches b on b.id=a.branch_id where a.organization_id=p_organization_id
 ), visits as (
  select * from all_visits where report_day between p_start_date and p_end_date
 ), completed as (select * from visits where status='completed'),
 ledger as (
  select p.*,(p.paid_at at time zone b.timezone)::date report_day from public.payments p join branches b on b.id=p.branch_id where p.organization_id=p_organization_id and p.status='paid'
 ), receipts as (select * from ledger where report_day between p_start_date and p_end_date),
 balances as (
  select a.id,greatest(a.expected_total_centavos-coalesce(sum(p.amount_centavos),0),0) balance from visits a left join ledger p on p.appointment_id=a.id and p.branch_id=a.branch_id where a.status not in('cancelled','no_show') group by a.id,a.expected_total_centavos
 ), lifetime as (
  select customer_id,count(*) visits,min(report_day) first_day from all_visits where status='completed' group by customer_id
 ), services as (
  select item.service_name_snapshot service,coalesce(category.name,'Uncategorized') category,sum(item.unit_price_centavos)::bigint revenue,count(*) quantity
  from completed a join public.appointment_services item on item.appointment_id=a.id
  left join public.services s on s.id=item.service_id and s.organization_id=p_organization_id
  left join public.service_categories category on category.id=s.category_id and category.organization_id=p_organization_id
  group by item.service_name_snapshot,coalesce(category.name,'Uncategorized')
  union all
  select item.description_snapshot,coalesce(item.category_name_snapshot,'Products'),sum(item.recognized_revenue_centavos)::bigint,sum(item.quantity)
  from product_bills i join public.invoice_items item on item.invoice_id=i.id group by item.description_snapshot,coalesce(item.category_name_snapshot,'Products')
 )
 select jsonb_build_object(
  'startDate',p_start_date,'endDate',p_end_date,
  'summary',jsonb_build_object(
   'grossSalesCentavos',(select coalesce(sum(expected_total_centavos),0) from completed)+(select coalesce(sum(total_centavos),0) from product_bills),
   'paymentsReceivedCentavos',(select coalesce(sum(amount_centavos),0) from receipts),
   'outstandingCentavos',(select coalesce(sum(balance),0) from balances)+(select coalesce(sum(balance_centavos),0) from product_bills),
   'jobsCompleted',(select count(*) from completed),
   'averageTicketCentavos',(select coalesce(round(avg(expected_total_centavos)),0) from completed),
   'customersServed',(select count(distinct customer_id) from completed),
   'repeatCustomers',(select count(*) from lifetime l where l.visits>1 and l.customer_id in(select customer_id from completed)),
   'newCustomers',(select count(*) from lifetime l where l.first_day between p_start_date and p_end_date and l.customer_id in(select customer_id from completed))
  ),
  'daily',(select coalesce(jsonb_agg(to_jsonb(x) order by x."day"),'[]') from (
   select report_day "day",sum(gross)::bigint "grossSalesCentavos",sum(received)::bigint "paymentsReceivedCentavos",sum(completed_count)::bigint "jobsCompleted" from (
    select report_day,expected_total_centavos gross,0::bigint received,1::bigint completed_count from completed
    union all select report_day,0,amount_centavos,0 from receipts
    union all select report_day,total_centavos,0,0 from product_bills
   ) amounts group by report_day
  ) x),
  'services',(select coalesce(jsonb_agg(jsonb_build_object('service',service,'category',category,'revenueCentavos',revenue,'quantity',quantity) order by revenue desc,service),'[]') from services),
  'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc,x.category),'[]') from (select category,sum(revenue)::bigint "revenueCentavos" from services group by category) x),
  'technicians',(select coalesce(jsonb_agg(to_jsonb(x) order by x."assignedJobs" desc,x.name),'[]') from (
   select staff.id,staff.full_name name,count(distinct a.id)::bigint "assignedJobs",count(distinct a.id) filter(where a.status='completed')::bigint "completedJobs"
   from visits a join public.appointment_staff_assignments assignment on assignment.appointment_id=a.id and assignment.organization_id=p_organization_id
   join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id and staff.organization_id=p_organization_id
   where a.status not in('cancelled','no_show') group by staff.id,staff.full_name
  ) x),
  'branches',(select coalesce(jsonb_agg(to_jsonb(x) order by x."grossSalesCentavos" desc,x.name),'[]') from (
   select b.id,b.name,(coalesce(sum(a.expected_total_centavos),0)+coalesce((select sum(total_centavos) from product_bills where branch_id=b.id),0))::bigint "grossSalesCentavos",count(a.id)::bigint invoices from branches b left join completed a on a.branch_id=b.id group by b.id,b.name
  ) x)
 ) into result;
 if not advanced then
  return result || '{"services":[],"categories":[],"technicians":[],"branches":[]}'::jsonb;
 end if;
 return result;
end $$;
revoke all on function public.get_appointment_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_appointment_report(uuid,date,date,uuid) to authenticated;
comment on function public.get_appointment_report(uuid,date,date,uuid) is 'Permission, plan and branch protected appointment analytics. Sales use completed service snapshots by appointment date and posted retail bills by issue date; cash uses payment date. Average ticket and visit counts remain service-only. Legacy report keys map to neutral UI labels.';


create or replace function public.get_invoice_revenue_breakdown(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare result jsonb;begin
if not public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id) then
  raise exception 'Advanced reports require an eligible plan' using errcode='42501';
end if;
with lines as(select ii.description_snapshot service,coalesce(ii.category_name_snapshot,'Uncategorized')category,ii.quantity,ii.recognized_revenue_centavos from public.invoice_items ii join public.invoices i on i.id=ii.invoice_id join public.branches b on b.id=i.branch_id where i.organization_id=p_organization_id and i.status<>'void' and i.issued_at is not null and(i.issued_at at time zone b.timezone)::date between p_start_date and p_end_date and(p_branch_id is null or i.branch_id=p_branch_id)and public.can_access_branch(p_organization_id,i.branch_id))select jsonb_build_object('services',(select coalesce(jsonb_agg(to_jsonb(x)order by x."revenueCentavos" desc),'[]')from(select service,category,sum(recognized_revenue_centavos)::bigint "revenueCentavos",sum(quantity) quantity from lines group by service,category)x),'categories',(select coalesce(jsonb_agg(to_jsonb(x)order by x."revenueCentavos" desc),'[]')from(select category,sum(recognized_revenue_centavos)::bigint "revenueCentavos" from lines group by category)x))into result;return result;end$$;
revoke all on function public.get_invoice_revenue_breakdown(uuid,date,date,uuid)from public,anon;grant execute on function public.get_invoice_revenue_breakdown(uuid,date,date,uuid)to authenticated;

notify pgrst,'reload schema';
commit;
