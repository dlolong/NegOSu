begin;

-- Restore the current summary contract for installations that applied an early
-- checkout migration. In particular, invoice_ids must not shadow invoices.
-- This replaces only the reader; existing orders, payments and stock are untouched.
create or replace function public.get_checkout(p_checkout uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
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

notify pgrst, 'reload schema';
commit;
