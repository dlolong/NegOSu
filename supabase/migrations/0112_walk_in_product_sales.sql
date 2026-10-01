begin;

-- Retail sales may have no customer record; retain the exclusive transaction source check.
alter table public.checkouts drop constraint checkouts_check1;

create or replace function public.open_checkout(p_branch uuid,p_appointment uuid,p_invoice uuid,p_customer uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; customer uuid; customer_name text; saved uuid; receipt public.checkout_operations; payload jsonb; a public.appointments; i public.invoices;
begin
 select b.organization_id into org from public.branches b join public.organizations o on o.id=b.organization_id where b.id=p_branch and b.is_active and o.status='active';
 if org is null or auth.uid() is null or not public.has_org_role(org,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(org,p_branch) then raise exception 'Checkout access required' using errcode='42501'; end if;
 if p_request is null or num_nonnulls(p_appointment,p_invoice,p_customer)>1 then raise exception 'Choose one checkout source' using errcode='22023'; end if;
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
 elsif p_customer is not null then
  select id,full_name into customer,customer_name from public.customers where id=p_customer and organization_id=org and not is_archived for share;
  if customer is null then raise exception 'Customer unavailable' using errcode='42501'; end if;
 else
  customer_name:='Walk-in customer';
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

notify pgrst, 'reload schema';
commit;
