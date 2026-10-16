-- Staff transaction detail reuses canonical work attribution and report authorization.
begin;
create function public.get_staff_transaction_report(p_org uuid,p_start date,p_end date,p_branch uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.authorize_report_scope(p_org,p_start,p_end,p_branch,true);
 with work as materialized (
  select w.*,b.timezone from public.staff_completed_work w
  join public.branches b on b.id=w.branch_id and b.organization_id=w.organization_id
  where w.organization_id=p_org and (p_branch is null or w.branch_id=p_branch)
   and public.can_access_branch(p_org,w.branch_id) and w.staff_id is not null
   and w.occurred_at>=p_start::timestamp at time zone b.timezone
   and w.occurred_at<(p_end+1)::timestamp at time zone b.timezone
 ), priced as (
  select w.kind||':'||w.record_id||':'||w.staff_id key,w.staff_name staff,w.occurred_at,w.timezone,
   w.work_label transaction,w.customer_name client,
   coalesce(a.expected_total_centavos,0)+coalesce(bills.amount,0) price
  from work w
  left join public.appointments a on w.kind='appointment' and a.id=w.target_id
   and a.organization_id=p_org and a.branch_id=w.branch_id
  cross join lateral (
   select sum(i.total_centavos)::bigint amount from public.invoices i
   where i.organization_id=p_org and i.branch_id=w.branch_id and i.status in('issued','partially_paid','paid')
    and (
     w.kind='job' and (i.job_order_id=w.target_id or exists(
      select 1 from public.checkout_invoices ci join public.checkouts ch on ch.id=ci.checkout_id
      join public.invoices src on src.id=ch.source_invoice_id and src.organization_id=p_org and src.branch_id=w.branch_id
      where ci.invoice_id=i.id and ch.organization_id=p_org and ch.branch_id=w.branch_id and src.job_order_id=w.target_id))
     or w.kind='appointment' and exists(
      select 1 from public.checkout_invoices ci join public.checkouts ch on ch.id=ci.checkout_id
      where ci.invoice_id=i.id and ch.organization_id=p_org and ch.branch_id=w.branch_id and ch.appointment_id=w.target_id)
     or w.kind='stay' and exists(
      select 1 from public.hospitality_stay_bills sb where sb.invoice_id=i.id and sb.organization_id=p_org and sb.branch_id=w.branch_id and sb.stay_id=w.target_id)
    )
  ) bills
 ) select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(p) order by p.occurred_at desc,p.staff,p.key),'[]'::jsonb)) into result from priced p;
 if jsonb_array_length(result->'rows')>10000 or octet_length(result::text)>5242880 then
  raise exception 'Narrow the report scope' using errcode='54000';
 end if;
 return result;
end $$;
revoke all on function public.get_staff_transaction_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_staff_transaction_report(uuid,date,date,uuid) to authenticated;

create or replace function public.generate_credit_report(p_org uuid,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.trial_credit_operations; charge integer:=0; result jsonb; revenue jsonb; advanced boolean;
 start_day date; end_day date; branch uuid; report_kind text; action_kind text; industry_key text; scope_ids uuid[]; member_role public.organization_role;
begin
 if auth.uid() is null or not public.has_permission(p_org,'reports.view') then raise exception 'Reporting access required' using errcode='42501'; end if;
 if p_request is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>2048 then raise exception 'Invalid report request' using errcode='22023'; end if;
 start_day:=(p_payload->>'start')::date; end_day:=(p_payload->>'end')::date; branch:=(p_payload->>'branch')::uuid;
 report_kind:=p_payload->>'kind'; action_kind:=p_payload->>'action';
 if start_day is null or end_day is null or not isfinite(start_day) or not isfinite(end_day) or end_day<start_day or end_day-start_day>731
 or report_kind is null or report_kind not in('clients','overview','hospitality','catalog','staff') or action_kind is null or action_kind not in('advanced_report','csv_export')
 or coalesce(length(p_payload->>'client'),0)>120 or coalesce(length(p_payload->>'item'),0)>120 then raise exception 'Invalid report filters' using errcode='22023'; end if;
 select industry into industry_key from public.organizations where id=p_org;
 select role into member_role from public.organization_memberships where organization_id=p_org and user_id=auth.uid() and is_active;
 if (report_kind='hospitality' and industry_key<>'hospitality') or (report_kind='overview' and industry_key='hospitality') then raise exception 'Invalid report type' using errcode='22023'; end if;
 advanced:=public.has_entitlement(p_org,'advanced_reports');
 if not advanced and (action_kind='csv_export' or branch is null or coalesce(p_payload->>'client','')<>'' or coalesce(p_payload->>'item','')<>'') then
  return jsonb_build_object('code','FEATURE_NOT_ENTITLED');
 end if;
 perform public.authorize_report_scope(p_org,start_day,end_day,branch,true);
 -- Serialize snapshot retries without creating or touching a credit account.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_request::text,0));
 select * into op from public.trial_credit_operations where organization_id=p_org and request_id=p_request;
 if found then
  if op.actor_id<>auth.uid() or op.payload<>p_payload or op.feature<>action_kind then raise exception 'Request key already used' using errcode='22023'; end if;
  return public.read_credit_report(p_org,p_request);
 end if;
 select coalesce(array_agg(id),'{}') into scope_ids from public.branches where organization_id=p_org and (branch is null or id=branch) and public.can_access_branch(p_org,id);
 if report_kind='staff' then
  result:=public.get_staff_transaction_report(p_org,start_day,end_day,branch);
 elsif report_kind='catalog' then
  result:=public.get_catalog_financial_report(p_org,start_day,end_day,branch,p_payload->>'section');
 elsif report_kind='clients' then
  result:=public.client_purchase_report_data(p_org,start_day,end_day,branch,coalesce(p_payload->>'client',''),coalesce(p_payload->>'item',''),coalesce(p_payload->>'purchaseKind','all'),1,true);
 elsif report_kind='hospitality' then
  result:=public.hospitality_report_rows_data(p_org,branch,start_day,end_day,coalesce(p_payload->>'section','stays'));
 elsif industry_key='automotive' then
  result:=public.get_owner_report(p_org,start_day,end_day,branch);
  if advanced then revenue:=public.get_invoice_revenue_breakdown(p_org,start_day,end_day,branch);
  result:=result||jsonb_build_object('services',revenue->'services','categories',revenue->'categories'); end if;
 else
  result:=public.get_appointment_report(p_org,start_day,end_day,branch);
 end if;
 if result is null or octet_length(result::text)>5242880 then raise exception 'Narrow the report scope' using errcode='54000'; end if;
 insert into public.trial_credit_operations(organization_id,request_id,actor_id,actor_role,feature,payload,cost,completed,result,branch_ids)
 values(p_org,p_request,auth.uid(),member_role,action_kind,p_payload,charge,true,result,scope_ids);
 return public.read_credit_report(p_org,p_request);
end $$;


notify pgrst,'reload schema';
commit;
