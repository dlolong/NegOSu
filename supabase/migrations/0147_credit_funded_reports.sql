-- Free-plan report generation and CSV preparation use the previously approved 1-credit cost.
-- Paid advanced reports remain unmetered. No other entitlement is changed.
begin;
insert into public.credit_operation_registry(operation_key,label,entitlement,credit_cost,enabled,billable_event)
values ('advanced_report','Filtered report',null,1,true,'operation_committed'),
 ('csv_export','Report CSV preparation',null,1,true,'operation_committed');

-- Report access is temporary and transaction-scoped, reachable only through the checked adapter.
-- Public entitlement responses remain plan-only; clients cannot create report contexts.
create or replace function public.has_entitlement(p_organization_id uuid,p_feature text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((public.effective_entitlements(p_organization_id)->'features'->>p_feature)::boolean,false)
 or (p_feature='advanced_reports' and exists(select 1 from public.trial_report_context where organization_id=p_organization_id and transaction_id=txid_current()))
$$;

create or replace function public.read_credit_report(p_org uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; member_role public.organization_role;
begin
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 if not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request and actor_id=auth.uid() and completed and feature in('advanced_report','csv_export');
 if not found or member_role is distinct from op.actor_role or exists(select 1 from unnest(op.branch_ids) b where not public.can_access_branch(p_org,b)) then
  raise exception 'Saved report not available' using errcode='42501';
 end if;
 if exists(select 1 from public.organizations where id=p_org and financial_report_roles_only)
 and not public.has_org_role(p_org,array['owner','manager','advisor','cashier']::public.organization_role[]) then
  raise exception 'Financial reporting access required' using errcode='42501';
 end if;
 if op.payload->>'section' in('inventory','movements') and not public.has_permission(p_org,'inventory.manage') then raise exception 'Inventory access required' using errcode='42501'; end if;
 return jsonb_build_object('id',op.request_id,'payload',op.payload,'report',op.result,'cost',op.cost,'createdAt',op.created_at,'remaining',case when exists(select 1 from public.organization_credit_grants where organization_id=p_org) then (public.credit_balance_data(p_org)->>'remaining')::integer else coalesce((select remaining from public.trial_credit_accounts where organization_id=p_org),100) end);
end $$;
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
 or report_kind is null or report_kind not in('clients','overview','hospitality') or action_kind is null or action_kind not in('advanced_report','csv_export')
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
 if report_kind='clients' then
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

revoke all on function public.generate_credit_report(uuid,uuid,jsonb),public.read_credit_report(uuid,uuid) from public,anon;
grant execute on function public.generate_credit_report(uuid,uuid,jsonb),public.read_credit_report(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
