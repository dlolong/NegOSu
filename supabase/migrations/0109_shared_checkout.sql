begin;

-- Checkout composes existing financial documents; it is not a second payment ledger.
create table public.checkouts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 branch_id uuid not null, customer_id uuid references public.customers(id), customer_name text not null,
 appointment_id uuid references public.appointments(id), source_invoice_id uuid references public.invoices(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 check(num_nonnulls(appointment_id,source_invoice_id)<=1),
 check(num_nonnulls(appointment_id,source_invoice_id,customer_id)>0)
);
create unique index checkout_appointment_unique on public.checkouts(appointment_id) where appointment_id is not null;
create unique index checkout_source_invoice_unique on public.checkouts(source_invoice_id) where source_invoice_id is not null;
create table public.checkout_invoices (
 checkout_id uuid not null references public.checkouts(id), invoice_id uuid not null unique references public.invoices(id),
 created_at timestamptz not null default now(), primary key(checkout_id,invoice_id)
);
create table public.checkout_lines (
 id uuid primary key default gen_random_uuid(), checkout_id uuid not null references public.checkouts(id),
 inventory_item_id uuid not null references public.inventory_items(id), name text not null, unit text not null, category text,
 quantity numeric(14,3) not null check(quantity>0), unit_price_centavos bigint not null check(unit_price_centavos between 0 and 10000000000),
 line_total_centavos bigint generated always as (round(quantity*unit_price_centavos)::bigint) stored,
 included_key text, promo_name text, stock_tracked boolean not null,
 reservation_id uuid references public.inventory_reservations(id), invoice_id uuid references public.invoices(id),
 handed_over numeric(14,3) not null default 0, returned numeric(14,3) not null default 0,
 version integer not null default 1, removed_at timestamptz, created_at timestamptz not null default now(),
 check(handed_over>=0 and handed_over<=quantity and returned>=0 and returned<=handed_over),
 check(included_key is null or unit_price_centavos=0), unique(checkout_id,included_key)
);
create table public.checkout_operations (
 organization_id uuid not null references public.organizations(id), request_key uuid not null,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(organization_id,request_key)
);
-- Preserve exact native quantities on the existing invoice ledger.
alter table public.invoice_items alter column quantity type numeric(14,3);

create function public.can_access_checkout(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.checkouts c where c.id=p_id and auth.uid() is not null
 and exists(select 1 from public.organizations where id=c.organization_id and status='active')
 and public.has_org_role(c.organization_id,array['owner','manager','cashier']::public.organization_role[]) and public.can_access_branch(c.organization_id,c.branch_id))
$$;
revoke all on function public.can_access_checkout(uuid) from public,anon;
grant execute on function public.can_access_checkout(uuid) to authenticated;
alter table public.checkouts enable row level security;
alter table public.checkout_lines enable row level security;
alter table public.checkout_invoices enable row level security;
alter table public.checkout_operations enable row level security;
revoke all on public.checkouts,public.checkout_lines,public.checkout_invoices,public.checkout_operations from public,anon,authenticated;
grant select on public.checkouts,public.checkout_lines,public.checkout_invoices to authenticated;
create policy checkout_read on public.checkouts for select to authenticated using(public.can_access_checkout(id));
create policy checkout_lines_read on public.checkout_lines for select to authenticated using(public.can_access_checkout(checkout_id));
create policy checkout_invoices_read on public.checkout_invoices for select to authenticated using(public.can_access_checkout(checkout_id));

-- A protected context is required before any stock or financial mutation.
create function public.lock_checkout(p_id uuid,p_allow_closed boolean default false) returns public.checkouts language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts;
begin
 select * into c from public.checkouts where id=p_id for update;
 if c.id is null or not public.can_access_checkout(c.id) then raise exception 'Checkout unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.branches where id=c.branch_id and organization_id=c.organization_id and is_active) then raise exception 'Branch unavailable' using errcode='22023'; end if;
 if c.appointment_id is not null then
  perform 1 from public.appointments where id=c.appointment_id and organization_id=c.organization_id and branch_id=c.branch_id and (p_allow_closed or status not in('cancelled','no_show')) for update;
  if not found then raise exception 'Visit unavailable for checkout' using errcode='22023'; end if;
 elsif c.source_invoice_id is not null then
  perform 1 from public.invoices where id=c.source_invoice_id and organization_id=c.organization_id and branch_id=c.branch_id and (p_allow_closed or status in('issued','partially_paid','paid')) for update;
  if not found then raise exception 'Bill unavailable for checkout' using errcode='22023'; end if;
 end if;
 return c;
end $$;
revoke all on function public.lock_checkout(uuid,boolean) from public,anon,authenticated;

create function public.open_checkout(p_branch uuid,p_appointment uuid,p_invoice uuid,p_customer uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; customer uuid; customer_name text; saved uuid; receipt public.checkout_operations; payload jsonb; a public.appointments; i public.invoices;
begin
 select b.organization_id into org from public.branches b join public.organizations o on o.id=b.organization_id where b.id=p_branch and b.is_active and o.status='active';
 if org is null or auth.uid() is null or not public.has_org_role(org,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(org,p_branch) then raise exception 'Checkout access required' using errcode='42501'; end if;
 if p_request is null or num_nonnulls(p_appointment,p_invoice,p_customer)<>1 then raise exception 'Choose one checkout source' using errcode='22023'; end if;
 payload:=jsonb_build_array('open',auth.uid(),p_branch,p_appointment,p_invoice,p_customer);
 perform pg_advisory_xact_lock(hashtextextended(org::text||p_request::text,0));
 select * into receipt from public.checkout_operations where organization_id=org and request_key=p_request;
 if found then if receipt.payload is distinct from payload then raise exception 'Request reused with different details' using errcode='22023'; end if; return (receipt.result->>'id')::uuid; end if;
 if p_appointment is not null then
  select * into a from public.appointments where id=p_appointment and organization_id=org and branch_id=p_branch and status not in('cancelled','no_show') for update;
  if a.id is null or not exists(select 1 from public.organizations where id=org and industry in('salon','pet_care')) then raise exception 'Visit unavailable' using errcode='42501'; end if;
  customer:=a.customer_id; select full_name into customer_name from public.customers where id=customer and organization_id=org;
  select id into saved from public.checkouts where appointment_id=a.id;
 elsif p_invoice is not null then
  select * into i from public.invoices where id=p_invoice and organization_id=org and branch_id=p_branch and status in('issued','partially_paid','paid') for update;
  if i.id is null then raise exception 'Bill unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.checkout_invoices where invoice_id=i.id) then raise exception 'Open the original checkout' using errcode='22023'; end if;
  customer_name:=i.customer_name_snapshot; select id into saved from public.checkouts where source_invoice_id=i.id;
 else
  select id,full_name into customer,customer_name from public.customers where id=p_customer and organization_id=org and not is_archived for share;
  if customer is null then raise exception 'Customer unavailable' using errcode='42501'; end if;
 end if;
 if saved is null then
  insert into public.checkouts(organization_id,branch_id,customer_id,customer_name,appointment_id,source_invoice_id,created_by)
   values(org,p_branch,customer,customer_name,p_appointment,p_invoice,auth.uid()) returning id into saved;
 end if;
 insert into public.checkout_operations values(org,p_request,payload,jsonb_build_object('id',saved),now());
 return saved;
end $$;
revoke all on function public.open_checkout(uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.open_checkout(uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Keep a single stock mutation implementation. Public wrappers preserve existing access;
-- checkout calls the private ledger only after validating its commercial line.
alter function public.reserve_inventory(uuid,text,uuid,numeric,text) rename to reserve_inventory_ledger;
create or replace function public.reserve_inventory_ledger(
  p_item_id uuid,p_reference_type text,p_reference_id uuid,p_quantity numeric,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; reservation_id uuid; operation_key text; prior_operation record;
begin
  select * into item from public.inventory_items where id=p_item_id for update;
  if item.id is null or not item.is_active
    or not public.has_org_role(item.organization_id,array['owner','manager','advisor','cashier']::public.organization_role[])
    or not public.can_access_branch(item.organization_id,item.branch_id)
  then raise exception 'Inventory item not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity>999999999 or p_quantity<>round(p_quantity,3) or p_reference_id is null
    or coalesce(p_reference_type,'') !~ '^[a-z][a-z0-9_]{2,80}$'
    or operation_key is null or char_length(operation_key)>200
  then raise exception 'Invalid reservation'; end if;

  select operation.*,reservation.inventory_item_id,reservation.reference_type,reservation.reference_id into prior_operation
  from public.inventory_reservation_operations operation join public.inventory_reservations reservation on reservation.id=operation.reservation_id
  where operation.organization_id=item.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'reserve' or prior_operation.quantity<>p_quantity
      or prior_operation.inventory_item_id<>p_item_id or prior_operation.reference_type<>p_reference_type
      or prior_operation.reference_id<>p_reference_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.reservation_id;
  end if;

  if public.inventory_available_balance(item.id)<p_quantity then raise exception 'Insufficient available stock'; end if;
  insert into public.inventory_reservations(
    organization_id,branch_id,inventory_item_id,reference_type,reference_id,quantity_reserved,created_by
  ) values(item.organization_id,item.branch_id,item.id,p_reference_type,p_reference_id,p_quantity,auth.uid())
  on conflict(organization_id,branch_id,inventory_item_id,reference_type,reference_id) do update
    set quantity_reserved=inventory_reservations.quantity_reserved+excluded.quantity_reserved,updated_at=now()
  returning id into reservation_id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(item.organization_id,reservation_id,'reserve',p_quantity,operation_key,auth.uid());
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(item.organization_id,auth.uid(),'inventory_reservation',reservation_id,'inventory.reserved',
    jsonb_build_object('inventory_item_id',item.id,'branch_id',item.branch_id,'reference_type',p_reference_type,
      'reference_id',p_reference_id,'quantity',p_quantity));
  return reservation_id;
end $$;
revoke all on function public.reserve_inventory_ledger(uuid,text,uuid,numeric,text) from public,anon,authenticated;

create function public.reserve_inventory(p_item_id uuid,p_reference_type text,p_reference_id uuid,p_quantity numeric,p_idempotency_key text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_reference_type='checkout_line' or not exists(select 1 from public.inventory_items i where i.id=p_item_id and public.has_org_role(i.organization_id,array['owner','manager','advisor']::public.organization_role[])) then raise exception 'Use the authorized inventory workflow' using errcode='42501'; end if;
 return public.reserve_inventory_ledger(p_item_id,p_reference_type,p_reference_id,p_quantity,p_idempotency_key);
end $$;
revoke all on function public.reserve_inventory(uuid,text,uuid,numeric,text) from public,anon;
grant execute on function public.reserve_inventory(uuid,text,uuid,numeric,text) to authenticated;

alter function public.consume_inventory_reservation(uuid,numeric,text) rename to consume_inventory_reservation_ledger;
create or replace function public.consume_inventory_reservation_ledger(
  p_reservation_id uuid,p_quantity numeric,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare initial_reservation public.inventory_reservations; reservation public.inventory_reservations;
  item public.inventory_items; operation_key text; movement_id uuid; prior_operation record;
begin
  select * into initial_reservation from public.inventory_reservations where id=p_reservation_id;
  if initial_reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  select * into item from public.inventory_items where id=initial_reservation.inventory_item_id for update;
  select * into reservation from public.inventory_reservations where id=p_reservation_id for update;
  if reservation.id is null or item.id is null
    or not public.has_org_role(reservation.organization_id,array['owner','manager','advisor','technician','cashier']::public.organization_role[])
    or not public.can_access_branch(reservation.organization_id,reservation.branch_id)
  then raise exception 'Reservation not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity<>round(p_quantity,3) or operation_key is null or char_length(operation_key)>200 then raise exception 'Invalid consumption'; end if;
  select operation.*,movement.id movement_id into prior_operation from public.inventory_reservation_operations operation
    left join public.inventory_movements movement on movement.organization_id=operation.organization_id
      and movement.idempotency_key='reservation:'||operation.idempotency_key
    where operation.organization_id=reservation.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'consume' or prior_operation.quantity<>p_quantity
      or prior_operation.reservation_id<>p_reservation_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.movement_id;
  end if;
  if reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released<p_quantity
    then raise exception 'Consumption exceeds reserved quantity'; end if;
  if public.inventory_item_balance(item.id)<p_quantity then raise exception 'Insufficient physical stock'; end if;

  update public.inventory_reservations set quantity_consumed=quantity_consumed+p_quantity,updated_at=now()
    where id=reservation.id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(reservation.organization_id,reservation.id,'consume',p_quantity,operation_key,auth.uid());
  insert into public.inventory_movements(
    organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,
    idempotency_key,note,created_by
  ) values(reservation.organization_id,reservation.branch_id,reservation.inventory_item_id,'usage',-p_quantity,
    'inventory_reservation',reservation.id,'reservation:'||operation_key,'Reserved inventory consumed',auth.uid())
  returning id into movement_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(reservation.organization_id,auth.uid(),'inventory_reservation',reservation.id,'inventory.consumed',
    jsonb_build_object('inventory_item_id',reservation.inventory_item_id,'branch_id',reservation.branch_id,'quantity',p_quantity));
  return movement_id;
end $$;
revoke all on function public.consume_inventory_reservation_ledger(uuid,numeric,text) from public,anon,authenticated;

create function public.consume_inventory_reservation(p_reservation_id uuid,p_quantity numeric,p_idempotency_key text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.inventory_reservations r where r.id=p_reservation_id and r.reference_type<>'checkout_line' and public.has_org_role(r.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])) then raise exception 'Use the authorized inventory workflow' using errcode='42501'; end if;
 return public.consume_inventory_reservation_ledger(p_reservation_id,p_quantity,p_idempotency_key);
end $$;
revoke all on function public.consume_inventory_reservation(uuid,numeric,text) from public,anon;
grant execute on function public.consume_inventory_reservation(uuid,numeric,text) to authenticated;

-- Replace the public facade while keeping its original signature below.
drop function public.release_inventory_reservation(uuid,numeric,text);
create or replace function public.release_inventory_reservation_ledger(
  p_reservation_id uuid,p_quantity numeric,p_idempotency_key text,p_cancelled_inclusion boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare initial_reservation public.inventory_reservations; reservation public.inventory_reservations;
  item public.inventory_items; operation_key text; operation_id uuid; prior_operation record;
begin
  select * into initial_reservation from public.inventory_reservations where id=p_reservation_id;
  if initial_reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  select * into item from public.inventory_items where id=initial_reservation.inventory_item_id for update;
  select * into reservation from public.inventory_reservations where id=p_reservation_id for update;
  if reservation.id is null or item.id is null
    or not (
      (public.has_org_role(reservation.organization_id,array['owner','manager','advisor','technician','cashier']::public.organization_role[])
       and public.can_access_branch(reservation.organization_id,reservation.branch_id))
      or (coalesce(p_cancelled_inclusion,false) and reservation.reference_type='checkout_line' and exists(
        select 1 from public.checkout_lines l join public.checkouts c on c.id=l.checkout_id join public.appointments a on a.id=c.appointment_id
        where l.id=reservation.reference_id and l.reservation_id=reservation.id and l.included_key is not null
        and c.organization_id=reservation.organization_id and c.branch_id=reservation.branch_id and a.status in('cancelled','no_show')))
    )
  then raise exception 'Reservation not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity<>round(p_quantity,3) or operation_key is null or char_length(operation_key)>200 then raise exception 'Invalid release'; end if;
  select operation.* into prior_operation from public.inventory_reservation_operations operation
    where operation.organization_id=reservation.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'release' or prior_operation.quantity<>p_quantity
      or prior_operation.reservation_id<>p_reservation_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.id;
  end if;
  if reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released<p_quantity
    then raise exception 'Release exceeds remaining reservation'; end if;
  update public.inventory_reservations set quantity_released=quantity_released+p_quantity,updated_at=now()
    where id=reservation.id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(reservation.organization_id,reservation.id,'release',p_quantity,operation_key,auth.uid()) returning id into operation_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(reservation.organization_id,auth.uid(),'inventory_reservation',reservation.id,'inventory.released',
    jsonb_build_object('inventory_item_id',reservation.inventory_item_id,'branch_id',reservation.branch_id,'quantity',p_quantity));
  return operation_id;
end $$;
revoke all on function public.release_inventory_reservation_ledger(uuid,numeric,text,boolean) from public,anon,authenticated;

create function public.release_inventory_reservation(p_reservation_id uuid,p_quantity numeric,p_idempotency_key text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.inventory_reservations r where r.id=p_reservation_id and r.reference_type<>'checkout_line' and public.has_org_role(r.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])) then raise exception 'Use the authorized inventory workflow' using errcode='42501'; end if;
 return public.release_inventory_reservation_ledger(p_reservation_id,p_quantity,p_idempotency_key);
end $$;
revoke all on function public.release_inventory_reservation(uuid,numeric,text) from public,anon;
grant execute on function public.release_inventory_reservation(uuid,numeric,text) to authenticated;

create function public.save_checkout_product(p_checkout uuid,p_line uuid,p_version integer,p_product uuid,p_quantity numeric,p_request uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; item public.inventory_items; line public.checkout_lines; receipt public.checkout_operations; payload jsonb; delta numeric; saved uuid;
begin
 c:=public.lock_checkout(p_checkout,p_quantity=0);
 if p_request is null or p_quantity is null or p_quantity<0 or p_quantity>999999 or p_quantity<>round(p_quantity,3) then raise exception 'Invalid product quantity' using errcode='22023'; end if;
 payload:=jsonb_build_array('product',auth.uid(),p_checkout,p_line,p_version,p_product,p_quantity);
 select * into receipt from public.checkout_operations where organization_id=c.organization_id and request_key=p_request;
 if found then if receipt.payload is distinct from payload then raise exception 'Request reused with different details' using errcode='22023'; end if; return (receipt.result->>'id')::uuid; end if;
 if p_line is not null then
  select * into line from public.checkout_lines where id=p_line and checkout_id=c.id for update;
  if line.id is null or line.version is distinct from p_version or line.inventory_item_id is distinct from p_product or line.removed_at is not null then raise exception 'Product changed; reload checkout' using errcode='40001'; end if;
  if line.invoice_id is not null or line.included_key is not null or line.handed_over>0 then raise exception 'Posted, included or handed-over products cannot be edited; use a return or additional sale' using errcode='22023'; end if;
 elsif p_quantity=0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;
 select * into item from public.inventory_items where id=p_product and organization_id=c.organization_id and branch_id=c.branch_id for update;
 if item.id is null or (p_quantity>0 and (not item.is_active or item.product_purpose='internal')) then raise exception 'Product unavailable in this branch' using errcode='42501'; end if;
 if round(p_quantity*coalesce(item.sell_price_centavos,0))>1000000000000 then raise exception 'Line amount limit exceeded' using errcode='22023'; end if;
 if line.id is null then
  insert into public.checkout_lines(checkout_id,inventory_item_id,name,unit,category,quantity,unit_price_centavos,stock_tracked)
   values(c.id,item.id,item.name,item.unit,item.category,p_quantity,coalesce(item.sell_price_centavos,0),item.stock_tracked) returning * into line;
  delta:=p_quantity;
 else delta:=p_quantity-line.quantity; end if;
 if line.stock_tracked then
  if delta>0 then
   line.reservation_id:=public.reserve_inventory_ledger(item.id,'checkout_line',line.id,delta,'checkout:'||p_request::text);
  elsif delta<0 then perform public.release_inventory_reservation_ledger(line.reservation_id,-delta,'checkout:'||p_request::text); end if;
 end if;
 update public.checkout_lines set quantity=case when p_quantity=0 then quantity else p_quantity end,removed_at=case when p_quantity=0 then now() else null end,reservation_id=line.reservation_id,version=version+1 where id=line.id returning id into saved;
 insert into public.checkout_operations values(c.organization_id,p_request,payload,jsonb_build_object('id',saved),now());
 return saved;
end $$;
revoke all on function public.save_checkout_product(uuid,uuid,integer,uuid,numeric,uuid) from public,anon;
grant execute on function public.save_checkout_product(uuid,uuid,integer,uuid,numeric,uuid) to authenticated;

-- Promo retail inclusions are imported once by explicit acceptance, never as extra revenue.
create function public.accept_checkout_inclusions(p_checkout uuid,p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; part record; item public.inventory_items; line_id uuid; reservation uuid; key text; qty numeric;
begin
 c:=public.lock_checkout(p_checkout);
 if p_request is null or c.appointment_id is null then raise exception 'Promo context required' using errcode='22023'; end if;
 for part in select distinct p.promo_id,p.name,component.value component from public.appointment_promo_snapshots p cross join lateral jsonb_array_elements(p.components) component
 where p.appointment_id=c.appointment_id and component.value->>'kind'='product' order by p.promo_id,component.value loop
  key:=part.promo_id::text||':'||(part.component->>'referenceId');
  if exists(select 1 from public.checkout_lines where checkout_id=c.id and included_key=key) then continue; end if;
  select * into item from public.inventory_items where id=(part.component->>'referenceId')::uuid and organization_id=c.organization_id and branch_id=c.branch_id for update;
  if item.id is null or not item.is_active or item.unit is distinct from part.component->>'unit' then raise exception 'Included product unavailable' using errcode='22023'; end if;
  qty:=(part.component->>'quantity')::numeric;
  insert into public.checkout_lines(checkout_id,inventory_item_id,name,unit,quantity,unit_price_centavos,stock_tracked,included_key,promo_name)
   values(c.id,item.id,part.component->>'name',item.unit,qty,0,item.stock_tracked,key,part.name) returning id into line_id;
  if item.stock_tracked then
   reservation:=public.reserve_inventory_ledger(item.id,'checkout_line',line_id,qty,'checkout-included:'||line_id::text);
   update public.checkout_lines set reservation_id=reservation where id=line_id;
  end if;
 end loop;
end $$;
revoke all on function public.accept_checkout_inclusions(uuid,uuid) from public,anon;
grant execute on function public.accept_checkout_inclusions(uuid,uuid) to authenticated;

create function public.fulfill_checkout_product(p_checkout uuid,p_line uuid,p_quantity numeric,p_action text,p_request uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; line public.checkout_lines; receipt public.checkout_operations; payload jsonb;
begin
 c:=public.lock_checkout(p_checkout,p_action='return');
 if p_request is null or p_quantity is null or p_quantity<=0 or p_quantity<>round(p_quantity,3) or p_action is null or p_action not in('handover','return') then raise exception 'Invalid fulfillment' using errcode='22023'; end if;
 payload:=jsonb_build_array('fulfillment',auth.uid(),p_checkout,p_line,p_quantity,p_action);
 select * into receipt from public.checkout_operations where organization_id=c.organization_id and request_key=p_request;
 if found then if receipt.payload is distinct from payload then raise exception 'Request reused with different details' using errcode='22023'; end if; return; end if;
 select * into line from public.checkout_lines where id=p_line and checkout_id=c.id and removed_at is null for update;
 if line.id is null then raise exception 'Checkout product unavailable' using errcode='42501'; end if;
 if p_action='handover' then
  if line.invoice_id is not null and exists(select 1 from public.invoices where id=line.invoice_id and status='void') then raise exception 'Voided products cannot be handed over' using errcode='22023'; end if;
  if line.handed_over+p_quantity>line.quantity then raise exception 'Handover exceeds ordered quantity' using errcode='22023'; end if;
  if line.stock_tracked then perform public.consume_inventory_reservation_ledger(line.reservation_id,p_quantity,'checkout:'||p_request::text); end if;
  update public.checkout_lines set handed_over=handed_over+p_quantity,version=version+1 where id=line.id;
 else
  if line.returned+p_quantity>line.handed_over then raise exception 'Return exceeds handed-over quantity' using errcode='22023'; end if;
  if line.stock_tracked then
   perform 1 from public.inventory_items where id=line.inventory_item_id for update;
   insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by)
   values(c.organization_id,c.branch_id,line.inventory_item_id,'return',p_quantity,'checkout_line',line.id,'checkout:'||p_request::text,'Checkout product returned; financial refund is separate',auth.uid());
  end if;
  update public.checkout_lines set returned=returned+p_quantity,version=version+1 where id=line.id;
 end if;
 insert into public.checkout_operations values(c.organization_id,p_request,payload,'{}',now());
end $$;
revoke all on function public.fulfill_checkout_product(uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.fulfill_checkout_product(uuid,uuid,numeric,text,uuid) to authenticated;

create function public.finalize_checkout(p_checkout uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; line public.checkout_lines; bill uuid; total bigint; receipt public.checkout_operations; payload jsonb;
begin
 c:=public.lock_checkout(p_checkout);
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 payload:=jsonb_build_array('finalize',auth.uid(),c.id);
 select * into receipt from public.checkout_operations where organization_id=c.organization_id and request_key=p_request;
 if found then if receipt.payload is distinct from payload then raise exception 'Request reused with different details' using errcode='22023'; end if; return (receipt.result->>'id')::uuid; end if;
 if c.appointment_id is not null and exists(select 1 from public.appointment_promo_snapshots p cross join lateral jsonb_array_elements(p.components) part where p.appointment_id=c.appointment_id and part->>'kind'='product' and not exists(select 1 from public.checkout_lines l where l.checkout_id=c.id and l.included_key=p.promo_id::text||':'||(part->>'referenceId'))) then raise exception 'Confirm included products before payment' using errcode='22023'; end if;
 for line in select * from public.checkout_lines where checkout_id=c.id and removed_at is null and (invoice_id is null or exists(select 1 from public.invoices where id=invoice_id and status<>'void')) order by inventory_item_id,id for update loop
  if line.stock_tracked and line.quantity>line.handed_over then
   perform 1 from public.inventory_items where id=line.inventory_item_id for update;
   if not exists(select 1 from public.inventory_reservations where id=line.reservation_id and quantity_reserved-quantity_consumed-quantity_released>=line.quantity-line.handed_over)
    or public.inventory_item_balance(line.inventory_item_id)<public.inventory_reserved_balance(line.inventory_item_id) then raise exception 'Reserved stock unavailable' using errcode='22023'; end if;
  end if;
 end loop;
 select coalesce(sum(line_total_centavos),0) into total from public.checkout_lines where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null;
 if exists(select 1 from public.checkout_lines where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null) then
  if total>1000000000000 then raise exception 'Bill limit exceeded' using errcode='22023'; end if;
  bill:=public.create_manual_invoice(c.organization_id,c.branch_id,c.customer_name);
  insert into public.invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos,recognized_revenue_centavos,category_name_snapshot,request_key)
   select bill,c.organization_id,name||' ('||unit||')',quantity,unit_price_centavos,line_total_centavos,line_total_centavos,coalesce(category,'Products'),id from public.checkout_lines where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null;
  update public.invoices set subtotal_centavos=total,total_centavos=total,balance_centavos=total,status='issued' where id=bill;
  insert into public.checkout_invoices(checkout_id,invoice_id) values(c.id,bill);
  update public.checkout_lines set invoice_id=bill,version=version+1 where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null;
 end if;
 if c.appointment_id is null and c.source_invoice_id is null and not exists(select 1 from public.checkout_invoices where checkout_id=c.id) then raise exception 'Add a product before payment' using errcode='22023'; end if;
 insert into public.checkout_operations values(c.organization_id,p_request,payload,jsonb_build_object('id',bill),now());
 return bill;
end $$;
revoke all on function public.finalize_checkout(uuid,uuid) from public,anon;
grant execute on function public.finalize_checkout(uuid,uuid) to authenticated;

create function public.get_checkout(p_checkout uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.checkouts; total bigint:=0; paid bigint:=0; base jsonb:='[]'; invoice_ids uuid[]; a public.appointments; i public.invoices; curr text; draft bigint;
begin
 select * into c from public.checkouts where id=p_checkout;
 if c.id is null or not public.can_access_checkout(c.id) then raise exception 'Checkout unavailable' using errcode='42501'; end if;
 select currency into curr from public.organizations where id=c.organization_id;
 select array_agg(invoice_id order by invoice_id) into invoice_ids from (select invoice_id from public.checkout_invoices where checkout_id=c.id union select c.source_invoice_id where c.source_invoice_id is not null) bills;
 if c.appointment_id is not null then
  select * into a from public.appointments where id=c.appointment_id and organization_id=c.organization_id and branch_id=c.branch_id;
  total:=a.expected_total_centavos;
  select coalesce(sum(amount_centavos),0) into paid from public.payments where appointment_id=a.id and status='paid';
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'unitPrice',price,'amount',amount)),'[]') into base from (
   select coalesce(p.name,s.service_name_snapshot) name,case when p.promo_id is null then s.service_id else p.promo_id end grouping_id,
   1 quantity,sum(s.unit_price_centavos) price,sum(s.unit_price_centavos) amount
   from public.appointment_services s left join public.appointment_promo_snapshots p on p.appointment_id=s.appointment_id and p.service_id=s.service_id where s.appointment_id=a.id
   group by coalesce(p.name,s.service_name_snapshot),case when p.promo_id is null then s.service_id else p.promo_id end
  ) parts;
 end if;
 if c.source_invoice_id is not null then
  select * into i from public.invoices where id=c.source_invoice_id and organization_id=c.organization_id and branch_id=c.branch_id;
  select coalesce(jsonb_agg(jsonb_build_object('name',case when i.status='void' then 'Voided: '||description_snapshot else description_snapshot end,'quantity',quantity,'unitPrice',unit_price_centavos,'amount',case when i.status='void' then 0 else line_total_centavos end)),'[]') into base from public.invoice_items where invoice_id=i.id;
 end if;
 select total+coalesce(sum(total_centavos),0),paid+coalesce(sum(paid_centavos),0) into total,paid from public.invoices where id=any(invoice_ids) and status<>'void';
 select coalesce(sum(line_total_centavos),0) into draft from public.checkout_lines where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null;
 total:=total+draft;
 return jsonb_build_object('id',c.id,'customer',c.customer_name,'customerId',c.customer_id,'appointmentId',c.appointment_id,'sourceInvoiceId',c.source_invoice_id,'currency',curr,'timezone',(select timezone from public.branches where id=c.branch_id),'createdAt',c.created_at,
 'total',total,'paid',paid,'balance',greatest(total-paid,0),'draftTotal',draft,'hasDraft',exists(select 1 from public.checkout_lines where checkout_id=c.id and removed_at is null and included_key is null and invoice_id is null),
 'tax',coalesce((select sum(tax_centavos) from public.invoices where id=any(invoice_ids) and status<>'void'),0),
 'discount',coalesce((select sum(discount_centavos) from public.invoices where id=any(invoice_ids) and status<>'void'),0),
 'baseLines',base,
 'promos',(select coalesce(jsonb_agg(jsonb_build_object('id',p.promo_id,'name',p.name,'services',(select coalesce(jsonb_agg(x->>'name'),'[]') from jsonb_array_elements(p.components)x where x->>'kind'='service'),'products',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(p.components) x where x->>'kind'='product'))),'[]') from (select distinct promo_id,name,components from public.appointment_promo_snapshots where appointment_id=c.appointment_id) p),
 'products',(select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('invoiceStatus',inv.status,'reserved',coalesce((select quantity_reserved-quantity_consumed-quantity_released from public.inventory_reservations where id=l.reservation_id),0)) order by l.created_at,l.id),'[]') from public.checkout_lines l left join public.invoices inv on inv.id=l.invoice_id where l.checkout_id=c.id and l.removed_at is null),
 'invoices',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'number',invoice_number,'status',status,'total',total_centavos,'paid',paid_centavos,'balance',balance_centavos) order by created_at,id),'[]') from public.invoices where id=any(invoice_ids)),
 'payments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount_centavos,'currency',currency,'method',method,'reference',reference,'date',paid_at,'status',status,'invoiceId',invoice_id) order by paid_at,id),'[]') from public.payments where organization_id=c.organization_id and (appointment_id=c.appointment_id or invoice_id=any(invoice_ids))));
end $$;
revoke all on function public.get_checkout(uuid) from public,anon;
grant execute on function public.get_checkout(uuid) to authenticated;

create function public.search_checkout_products(p_checkout uuid,p_search text default '',p_category text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.checkouts; result jsonb;
begin
 select * into c from public.checkouts where id=p_checkout;
 if c.id is null or not public.can_access_checkout(c.id) then raise exception 'Checkout unavailable' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 10000 or length(coalesce(p_search,''))>120 or length(coalesce(p_category,''))>80 then raise exception 'Invalid search' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(items)),'[]') into result from (
  select id,name,sku,category,unit,coalesce(sell_price_centavos,0) price,stock_tracked,
   case when stock_tracked then public.inventory_available_balance(id) end available
  from public.inventory_items where organization_id=c.organization_id and branch_id=c.branch_id and is_active and product_purpose in('retail','both')
  and (coalesce(p_search,'')='' or name ilike '%'||p_search||'%' or coalesce(sku,'') ilike '%'||p_search||'%' or coalesce(category,'') ilike '%'||p_search||'%')
  and (coalesce(p_category,'')='' or category ilike '%'||p_category||'%') order by name,id limit 20 offset (p_page-1)*20
 ) items;
 return result;
end $$;
revoke all on function public.search_checkout_products(uuid,text,text,integer) from public,anon;
grant execute on function public.search_checkout_products(uuid,text,text,integer) to authenticated;

create function public.record_checkout_payment(p_checkout uuid,p_amount bigint,p_method public.payment_method,p_reference text,p_date date,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.checkouts; receipt public.checkout_operations; payload jsonb; summary jsonb; remaining bigint; due bigint; portion bigint; pid uuid; bill public.invoices; ids jsonb:='[]'; tz text; curr text;
begin
 c:=public.lock_checkout(p_checkout);
 select b.timezone,o.currency into tz,curr from public.branches b join public.organizations o on o.id=b.organization_id where b.id=c.branch_id;
 if p_request is null or p_amount is null or p_amount<=0 or p_method is null or length(coalesce(p_reference,''))>100 or p_date is null or p_date>(now() at time zone tz)::date or p_date<(c.created_at at time zone tz)::date then raise exception 'Invalid payment details' using errcode='22023'; end if;
 payload:=jsonb_build_array('payment',auth.uid(),c.id,p_amount,p_method,p_reference,p_date);
 select * into receipt from public.checkout_operations where organization_id=c.organization_id and request_key=p_request;
 if found then if receipt.payload is distinct from payload then raise exception 'Request reused with different details' using errcode='22023'; end if; return receipt.result; end if;
 -- Serialize with existing payment APIs; never rely on browser balances.
 perform 1 from public.invoices where id=c.source_invoice_id or id in(select invoice_id from public.checkout_invoices where checkout_id=c.id) order by id for update;
 summary:=public.get_checkout(c.id);
 if c.appointment_id is not null and exists(select 1 from public.appointment_promo_snapshots p cross join lateral jsonb_array_elements(p.components) part where p.appointment_id=c.appointment_id and part->>'kind'='product' and not exists(select 1 from public.checkout_lines l where l.checkout_id=c.id and l.included_key=p.promo_id::text||':'||(part->>'referenceId'))) then raise exception 'Confirm included products before payment' using errcode='22023'; end if;
 if (summary->>'hasDraft')::boolean then raise exception 'Review checkout before payment' using errcode='22023'; end if;
 if p_amount>(summary->>'balance')::bigint then raise exception 'Payment exceeds remaining balance' using errcode='22023'; end if;
 remaining:=p_amount;
 if c.appointment_id is not null then
  select a.expected_total_centavos-coalesce((select sum(amount_centavos) from public.payments where appointment_id=a.id and status='paid'),0) into due from public.appointments a where a.id=c.appointment_id;
  portion:=least(remaining,greatest(due,0));
  if portion>0 then
   pid:=public.record_appointment_payment(c.appointment_id,portion,p_method,'checkout:'||p_request::text,p_reference,null);
   update public.payments set currency=curr,paid_at=case when p_date=(now() at time zone tz)::date then now() else (p_date+time '12:00') at time zone tz end where id=pid;
   ids:=ids||jsonb_build_array(pid);remaining:=remaining-portion;
  end if;
 end if;
 for bill in select * from public.invoices where (id=c.source_invoice_id or id in(select invoice_id from public.checkout_invoices where checkout_id=c.id)) and status in('issued','partially_paid') order by (id=c.source_invoice_id) desc,created_at,id loop
  exit when remaining=0;
  portion:=least(remaining,bill.balance_centavos);
  if portion>0 then
   pid:=public.record_invoice_collection(bill.id,portion,p_method,p_request,p_reference,null,p_date,curr);
   ids:=ids||jsonb_build_array(pid);remaining:=remaining-portion;
  end if;
 end loop;
 if remaining<>0 then raise exception 'Bill changed; reload checkout' using errcode='40001'; end if;
 insert into public.checkout_operations values(c.organization_id,p_request,payload,ids,now());
 return ids;
end $$;
revoke all on function public.record_checkout_payment(uuid,bigint,public.payment_method,text,date,uuid) from public,anon;
grant execute on function public.record_checkout_payment(uuid,bigint,public.payment_method,text,date,uuid) to authenticated;

-- Additional invoices are posted snapshots. Existing manual stay-charge APIs cannot rewrite them.
create function public.guard_checkout_posted_invoice() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_table_name='invoice_items' then
  if exists(select 1 from public.checkout_invoices where invoice_id=case when tg_op='DELETE' then old.invoice_id else new.invoice_id end or (tg_op='UPDATE' and invoice_id=old.invoice_id)) then raise exception 'Posted checkout lines require a separate adjustment' using errcode='22023'; end if;
 elsif exists(select 1 from public.checkout_invoices where invoice_id=old.id) and (new.subtotal_centavos,new.discount_centavos,new.tax_centavos,new.total_centavos,new.organization_id,new.branch_id) is distinct from (old.subtotal_centavos,old.discount_centavos,old.tax_centavos,old.total_centavos,old.organization_id,old.branch_id) then
  raise exception 'Posted checkout bill cannot be rewritten' using errcode='22023';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger checkout_invoice_item_immutable before insert or update or delete on public.invoice_items for each row execute function public.guard_checkout_posted_invoice();
create trigger checkout_invoice_total_immutable before update on public.invoices for each row execute function public.guard_checkout_posted_invoice();
revoke all on function public.guard_checkout_posted_invoice() from public,anon,authenticated;


create index checkout_scope on public.checkouts(organization_id,branch_id,created_at);
create index checkout_lines_bill on public.checkout_lines(invoice_id) where invoice_id is not null;
create function public.get_checkout_product_report(p_branch uuid,p_page integer default 1) returns jsonb
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

-- Voiding a bill releases unfulfilled allocations, but never fabricates a physical return.
create function public.release_void_checkout_stock() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare line public.checkout_lines; remaining numeric;
begin
 if new.status='void' and old.status is distinct from new.status then
  for line in select * from public.checkout_lines where invoice_id=new.id and reservation_id is not null order by inventory_item_id,id loop
   select quantity_reserved-quantity_consumed-quantity_released into remaining from public.inventory_reservations where id=line.reservation_id;
   if remaining>0 then perform public.release_inventory_reservation_ledger(line.reservation_id,remaining,'checkout-void:'||line.id::text); end if;
  end loop;
 end if;
 return new;
end $$;
create trigger checkout_void_stock after update of status on public.invoices for each row execute function public.release_void_checkout_stock();
revoke all on function public.release_void_checkout_stock() from public,anon,authenticated;



create function public.guard_checkout_product_identity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.unit,new.stock_tracked,new.organization_id,new.branch_id) is distinct from (old.unit,old.stock_tracked,old.organization_id,old.branch_id) and exists(select 1 from public.checkout_lines where inventory_item_id=old.id) then raise exception 'Checkout history exists; product stock identity cannot change' using errcode='22023'; end if;
 return new;
end $$;
create trigger checkout_product_identity before update on public.inventory_items for each row execute function public.guard_checkout_product_identity();
revoke all on function public.guard_checkout_product_identity() from public,anon,authenticated;
create function public.audit_checkout_line() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
 select organization_id,auth.uid(),'checkout_line',new.id,'checkout.product_changed',jsonb_build_object('checkout',new.checkout_id,'quantity',new.quantity,'handedOver',new.handed_over,'returned',new.returned,'version',new.version,'removed',new.removed_at is not null,'invoice',new.invoice_id) from public.checkouts where id=new.checkout_id;
 return new;
end $$;
create trigger checkout_product_audit after insert or update on public.checkout_lines for each row execute function public.audit_checkout_line();
revoke all on function public.audit_checkout_line() from public,anon,authenticated;

-- Apply branch enforcement to the canonical void path used by checkout adjustments.
create or replace function public.void_invoice(p_invoice_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare invoice public.invoices;
begin
 select * into invoice from public.invoices where id=p_invoice_id for update;
 if invoice.id is null or not public.has_org_role(invoice.organization_id,array['owner','manager']::public.organization_role[]) or not public.can_access_branch(invoice.organization_id,invoice.branch_id) then raise exception 'Invoice not found' using errcode='42501'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Void reason required' using errcode='22023'; end if;
 if invoice.paid_centavos<>0 or invoice.status not in ('issued','draft') then raise exception 'Paid invoice cannot be voided'; end if;
 update public.invoices set status='void',voided_at=now(),notes=concat_ws(E'\n',notes,'Void reason: '||trim(p_reason)) where id=invoice.id;
end $$;

-- A cancelled visit cannot retain reservations for uncollected promo inclusions.
-- Additional retail invoices keep their own financial/return lifecycle.
create function public.release_cancelled_checkout_inclusions() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare line public.checkout_lines; remaining numeric;
begin
 if new.status in('cancelled','no_show') and old.status is distinct from new.status then
  for line in select l.* from public.checkout_lines l join public.checkouts c on c.id=l.checkout_id where c.appointment_id=new.id and l.included_key is not null and l.reservation_id is not null order by l.inventory_item_id,l.id loop
   select quantity_reserved-quantity_consumed-quantity_released into remaining from public.inventory_reservations where id=line.reservation_id;
   if remaining>0 then perform public.release_inventory_reservation_ledger(line.reservation_id,remaining,'checkout-cancel:'||line.id::text,true); end if;
  end loop;
 end if;
 return new;
end $$;
create trigger checkout_cancelled_inclusions after update of status on public.appointments for each row execute function public.release_cancelled_checkout_inclusions();
revoke all on function public.release_cancelled_checkout_inclusions() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
