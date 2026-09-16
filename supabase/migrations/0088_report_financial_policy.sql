-- Neutral organization reporting policy; existing businesses keep their report
-- viewer behavior. A pilot can restrict financial aggregates to finance roles.
alter table public.organizations add column financial_report_roles_only boolean not null default false;
create function public.guard_financial_report_policy() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user in('anon','authenticated') and ((tg_op='INSERT' and new.financial_report_roles_only) or (tg_op='UPDATE' and new.financial_report_roles_only is distinct from old.financial_report_roles_only)) then raise exception 'Trusted report configuration required' using errcode='42501'; end if;
 return new;
end $$;
create trigger organization_financial_report_policy before insert or update on public.organizations for each row execute function public.guard_financial_report_policy();
create function public.authorize_report_scope(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid,p_financial boolean)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare advanced boolean; branch_today date;
begin
  if not public.has_permission(p_organization_id,'reports.view') then
    raise exception 'Reporting access required' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>731 then
    raise exception 'Invalid reporting range' using errcode='22023';
  end if;
  if p_branch_id is not null then
    select (now() at time zone b.timezone)::date into branch_today from public.branches b
    where b.id=p_branch_id and b.organization_id=p_organization_id and public.can_access_branch(p_organization_id,b.id);
    if not found then raise exception 'Branch not found' using errcode='42501'; end if;
  end if;
  if p_financial and exists(select 1 from public.organizations where id=p_organization_id and financial_report_roles_only)
    and not public.has_org_role(p_organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]) then
    raise exception 'Financial reporting access required' using errcode='42501';
  end if;
  advanced:=public.has_entitlement(p_organization_id,'advanced_reports');
  if not advanced and (p_branch_id is null or p_start_date<branch_today-29 or p_end_date>branch_today) then
    raise exception 'Free reports require one branch and dates within the last 30 days' using errcode='42501';
  end if;
  return advanced;
end $$;

revoke all on function public.authorize_report_scope(uuid,date,date,uuid,boolean) from public,anon,authenticated;
create or replace function public.authorize_report_scope(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.authorize_report_scope(p_organization_id,p_start_date,p_end_date,p_branch_id,true);
$$;
-- Hospitality owns its rollout policy configuration. No other vertical changes.
create function public.configure_hospitality_report_policy() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.organizations set financial_report_roles_only=true where id=new.organization_id; return new; end $$;
create trigger hospitality_report_policy after insert on public.hospitality_pilot_organizations for each row execute function public.configure_hospitality_report_policy();
update public.organizations set financial_report_roles_only=true where id in(select organization_id from public.hospitality_pilot_organizations);
