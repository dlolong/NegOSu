-- Free default tables: fixed seven branch-local days; no credits or snapshots.
begin;
create function public.get_recent_client_purchases(p_org uuid,p_branch uuid,p_kind text default 'all',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare today date; result jsonb; had_context boolean;
begin
 if auth.uid() is null or not public.has_permission(p_org,'reports.view') then
  raise exception 'Reporting access required' using errcode='42501';
 end if;
 select (now() at time zone b.timezone)::date into today from public.branches b
 where b.id=p_branch and b.organization_id=p_org and public.can_access_branch(p_org,b.id);
 if today is null then raise exception 'Branch not found' using errcode='42501'; end if;
 -- Enforce financial roles before granting the internal, transaction-only context.
 perform public.authorize_report_scope(p_org,today-6,today,p_branch,true);
 select exists(select 1 from public.trial_report_context where organization_id=p_org and transaction_id=txid_current()) into had_context;
 if not had_context then insert into public.trial_report_context values(p_org,txid_current()); end if;
 result:=public.client_purchase_report_data(p_org,today-6,today,p_branch,'','',p_kind,p_page,false);
 if not had_context then delete from public.trial_report_context where organization_id=p_org and transaction_id=txid_current(); end if;
 return result;
end $$;
revoke all on function public.get_recent_client_purchases(uuid,uuid,text,integer) from public,anon;
grant execute on function public.get_recent_client_purchases(uuid,uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
