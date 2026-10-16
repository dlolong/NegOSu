-- Financial catalog reports reuse canonical report authorization and credit adapter.
begin;
create function public.get_catalog_financial_report(p_org uuid,p_start date,p_end date,p_branch uuid,p_category text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; records jsonb;
begin
 perform public.authorize_report_scope(p_org,p_start,p_end,p_branch,true);
 if p_category not in('promos','rooms') or p_category is null then raise exception 'Invalid report category' using errcode='22023'; end if;
 if p_category='rooms' and (not public.hospitality_enabled(p_org) or not public.has_org_role(p_org,array['owner','manager','advisor','cashier']::public.organization_role[])) then raise exception 'Room finance access required' using errcode='42501'; end if;
 if p_category='promos' then
  with scope as (
   select b.* from public.branches b where b.organization_id=p_org and (p_branch is null or b.id=p_branch) and public.can_access_branch(p_org,b.id)
  ), accepted as (
   -- Each service snapshot holds its allocation, not the full promo price.
   select s.promo_id,a.id,a.status,sum(s.price_centavos)::bigint amount
   from public.appointment_promo_snapshots s join public.appointments a on a.id=s.appointment_id and a.organization_id=s.organization_id and a.branch_id=s.branch_id
   join scope b on b.id=a.branch_id
   where s.organization_id=p_org and a.starts_at>=p_start::timestamp at time zone b.timezone and a.starts_at<(p_end+1)::timestamp at time zone b.timezone
   and a.status not in('cancelled','no_show') group by s.promo_id,a.id,a.status
  ) select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.id),'[]'::jsonb) into records from (
   select p.id,p.name,b.name branch,p.status,p.price_centavos price,count(a.id) bookings,
    coalesce(sum(a.amount),0)::bigint amount,coalesce(sum(a.amount) filter(where a.status='completed'),0)::bigint revenue
   from public.commerce_promos p join scope b on b.id=p.branch_id left join accepted a on a.promo_id=p.id
   where p.organization_id=p_org group by p.id,b.name
  )x;
 else
  with scope as (
   select b.* from public.branches b where b.organization_id=p_org and (p_branch is null or b.id=p_branch) and public.can_access_branch(p_org,b.id)
  ), bills as (
   select s.room_id,i.id,i.total_centavos,i.paid_centavos from public.hospitality_stays s
   join scope b on b.id=s.branch_id join public.hospitality_stay_bills sb on sb.stay_id=s.id and sb.organization_id=p_org and sb.branch_id=s.branch_id
   join public.invoices i on i.id=sb.invoice_id and i.organization_id=p_org and i.branch_id=s.branch_id
   where s.organization_id=p_org and i.status in('issued','partially_paid','paid') and i.issued_at>=p_start::timestamp at time zone b.timezone and i.issued_at<(p_end+1)::timestamp at time zone b.timezone
  ) select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.id),'[]'::jsonb) into records from (
   select r.id,r.name,b.name branch,r.rates,
    case when not r.is_active then 'Inactive' when exists(select 1 from public.hospitality_stays s where s.room_id=r.id and s.organization_id=p_org and s.branch_id=r.branch_id and s.checked_out_at is null) then 'Occupied' when r.cleaning_required then 'Cleaning' else 'Vacant' end status,
    count(i.id) bills,coalesce(sum(i.total_centavos),0)::bigint amount,coalesce(sum(i.paid_centavos),0)::bigint revenue
   from public.hospitality_rooms r join scope b on b.id=r.branch_id left join bills i on i.room_id=r.id
   where r.organization_id=p_org group by r.id,b.name
  )x;
 end if;
 select jsonb_build_object('category',p_category,'rows',records,'count',jsonb_array_length(records),'summary',jsonb_build_object('amount',coalesce(sum((r->>'amount')::bigint),0),'revenue',coalesce(sum((r->>'revenue')::bigint),0))) into result from jsonb_array_elements(records) r;
 return result;
end $$;
revoke all on function public.get_catalog_financial_report(uuid,date,date,uuid,text) from public,anon;
grant execute on function public.get_catalog_financial_report(uuid,date,date,uuid,text) to authenticated;

-- Add financial amounts to stay rows and period totals without changing workspace scope.
alter function public.get_hospitality_workspace(uuid,uuid,date,date,text,integer,text) rename to hospitality_workspace_base_data;
revoke all on function public.hospitality_workspace_base_data(uuid,uuid,date,date,text,integer,text) from public,anon,authenticated;
create function public.get_hospitality_workspace(p_org uuid,p_branch uuid,p_start date,p_end date,p_section text default 'stays',p_page integer default 1,p_mode text default 'report') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; records jsonb; totals jsonb;
begin
 result:=public.hospitality_workspace_base_data(p_org,p_branch,p_start,p_end,p_section,p_page,p_mode);
 if not (result ? 'finance') or p_mode='overview' then return result; end if;
 if p_section='stays' then
  select coalesce(jsonb_agg(r||jsonb_build_object('charges',f.amount,'paid',f.paid,'balance',f.balance) order by n),'[]') into records
  from jsonb_array_elements(result->'rows') with ordinality x(r,n)
  cross join lateral(select coalesce(sum(i.total_centavos),0) amount,coalesce(sum(i.paid_centavos),0) paid,coalesce(sum(i.balance_centavos),0) balance
   from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id and i.organization_id=sb.organization_id and i.branch_id=sb.branch_id
   where sb.organization_id=p_org and sb.stay_id=(r->>'id')::uuid and public.can_access_branch(p_org,sb.branch_id) and i.status in('issued','partially_paid','paid')) f;
  result:=jsonb_set(result,'{rows}',records);
 end if;
 select jsonb_build_object('amount',coalesce(sum(i.total_centavos),0),'revenue',coalesce((result->'finance'->>'collected')::bigint,0)) into totals
 from public.hospitality_financial_documents d join public.invoices i on i.id=d.invoice_id and i.organization_id=d.organization_id and i.branch_id=d.branch_id
 join public.branches b on b.id=d.branch_id and b.organization_id=p_org
 where d.organization_id=p_org and (p_branch is null or d.branch_id=p_branch) and public.can_access_branch(p_org,d.branch_id) and i.status in('issued','partially_paid','paid')
 and i.issued_at>=p_start::timestamp at time zone b.timezone and i.issued_at<(p_end+1)::timestamp at time zone b.timezone;
 return result||jsonb_build_object('reportTotals',totals);
end $$;
revoke all on function public.get_hospitality_workspace(uuid,uuid,date,date,text,integer,text) from public,anon;
grant execute on function public.get_hospitality_workspace(uuid,uuid,date,date,text,integer,text) to authenticated;

create or replace function public.generate_credit_report(p_org uuid,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; balance integer; charge integer; result jsonb; revenue jsonb;
 start_day date; end_day date; branch uuid; report_kind text; action_kind text; industry_key text; scope_ids uuid[]; member_role public.organization_role; reservation jsonb; report_reservation_id uuid; allocation public.organization_credit_allocations;
begin
 if auth.uid() is null or not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 if p_request is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>2048 then raise exception 'Invalid report request' using errcode='22023'; end if;
 start_day:=(p_payload->>'start')::date; end_day:=(p_payload->>'end')::date; branch:=(p_payload->>'branch')::uuid;
 report_kind:=p_payload->>'kind'; action_kind:=p_payload->>'action';
 if start_day is null or end_day is null or not isfinite(start_day) or not isfinite(end_day) or end_day<start_day or end_day-start_day>731
 or report_kind is null or report_kind not in('clients','overview','hospitality','catalog') or action_kind is null or action_kind not in('advanced_report','csv_export')
 or coalesce(length(p_payload->>'client'),0)>120 or coalesce(length(p_payload->>'item'),0)>120 then raise exception 'Invalid report filters' using errcode='22023'; end if;
 select industry into industry_key from public.organizations where id=p_org;
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 if (report_kind='hospitality' and industry_key<>'hospitality') or (report_kind='overview' and industry_key='hospitality') then raise exception 'Invalid report type' using errcode='22023'; end if;
 -- One row lock serializes all spending for this business, including image finalization.
 perform public.ensure_credit_period(p_org);
 select remaining into balance from public.trial_credit_accounts where organization_id=p_org for update;
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request;
 if found then
  if op.actor_id<>auth.uid() or op.payload<>p_payload or op.feature<>action_kind then raise exception 'Request key already used' using errcode='22023'; end if;
  return public.read_credit_report(p_org,p_request);
 end if;
 charge:=case when coalesce((public.plan_entitlements(p_org)->'features'->>'advanced_reports')::boolean,false) then 0 else coalesce((select case when enabled then credit_cost else 0 end from public.credit_operation_registry where operation_key=action_kind),0) end;
 if coalesce((p_payload->>'maxCost')::integer,1) not in(0,1) then raise exception 'Invalid credit cost' using errcode='22023'; end if;
 if charge>coalesce((p_payload->>'maxCost')::integer,1) then raise exception 'Plan access changed' using errcode='P0002'; end if;
 if charge>0 then
  reservation:=public.reserve_credit_operation(p_org,action_kind,p_request,p_request::text,p_payload||jsonb_build_object('actor',auth.uid()));
  if reservation->>'code'='INSUFFICIENT_CREDITS' then return reservation; end if;
  if reservation->>'code'<>'CREDIT_RESERVED' then raise exception 'Invalid report credit reservation' using errcode='22023'; end if;
  select id into report_reservation_id from public.organization_credit_reservations where organization_id=p_org and operation_key=action_kind and idempotency_key=p_request::text;
 end if;
 insert into public.trial_report_context values(p_org,txid_current());
 -- Preserve canonical financial-role and branch checks, including on empty results.
 perform public.authorize_report_scope(p_org,start_day,end_day,branch,true);
 select coalesce(array_agg(id),'{}') into scope_ids from public.branches where organization_id=p_org and (branch is null or id=branch) and public.can_access_branch(p_org,id);
 if report_kind='catalog' then
  result:=public.get_catalog_financial_report(p_org,start_day,end_day,branch,p_payload->>'section');
 elsif report_kind='clients' then
  result:=public.client_purchase_report_data(p_org,start_day,end_day,branch,coalesce(p_payload->>'client',''),coalesce(p_payload->>'item',''),coalesce(p_payload->>'purchaseKind','all'),1,true);
 elsif report_kind='hospitality' then
  result:=public.export_hospitality_workspace(p_org,branch,start_day,end_day,coalesce(p_payload->>'section','stays'));
 elsif industry_key='automotive' then
  result:=public.get_owner_report(p_org,start_day,end_day,branch);
  revenue:=public.get_invoice_revenue_breakdown(p_org,start_day,end_day,branch);
  result:=result||jsonb_build_object('services',revenue->'services','categories',revenue->'categories');
 else
  result:=public.get_appointment_report(p_org,start_day,end_day,branch);
 end if;
 if result is null or octet_length(result::text)>5242880 then raise exception 'Narrow the report scope' using errcode='54000'; end if;
 delete from public.trial_report_context where organization_id=p_org and transaction_id=txid_current();
 insert into public.trial_credit_operations(organization_id,request_id,actor_id,actor_role,feature,payload,cost,completed,result,branch_ids)
 values(p_org,p_request,auth.uid(),member_role,action_kind,p_payload,charge,true,result,scope_ids);
 if report_reservation_id is not null then
  for allocation in select * from public.organization_credit_allocations where organization_id=p_org and reservation_id=report_reservation_id loop
   insert into public.organization_credit_ledger(organization_id,grant_id,reservation_id,transaction_type,amount,reason_code,operation_key,idempotency_key,created_by)
   values(p_org,allocation.grant_id,report_reservation_id,'USAGE',-allocation.amount,'operation_committed',action_kind,'usage:'||report_reservation_id||':'||allocation.grant_id,auth.uid());
  end loop;
  update public.organization_credit_reservations set status='committed',updated_at=now() where id=report_reservation_id;
 end if;
 -- Keep the original one-time balance accurate for legacy readers; the ledger is authoritative.
 update public.trial_credit_accounts set remaining=(public.credit_balance_data(p_org)->>'oneTimeRemaining')::integer where organization_id=p_org;
 perform public.notify_credit_threshold(p_org);
 return public.read_credit_report(p_org,p_request);
end $$;

notify pgrst,'reload schema';
commit;
