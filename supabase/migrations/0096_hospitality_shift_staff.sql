-- Operational shift attribution is separate from the authenticated financial actor.
create table public.hospitality_stay_staff_events(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null, stay_id uuid not null,
 phase text not null check(phase in ('check_in','check_out')),
 cashier_staff_id uuid not null, housekeeper_staff_id uuid not null,
 cashier_name text not null, housekeeper_name text not null,
 recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default now(),
 unique(stay_id,phase),
 foreign key(organization_id,branch_id,stay_id) references public.hospitality_stays(organization_id,branch_id,id),
 foreign key(organization_id,cashier_staff_id) references public.organization_staff_profiles(organization_id,id),
 foreign key(organization_id,housekeeper_staff_id) references public.organization_staff_profiles(organization_id,id));
create index hospitality_staff_events_branch on public.hospitality_stay_staff_events(organization_id,branch_id,recorded_at);
alter table public.hospitality_stay_staff_events enable row level security;
revoke all on public.hospitality_stay_staff_events from public,anon,authenticated;
grant select on public.hospitality_stay_staff_events to authenticated;
create policy hospitality_staff_events_read on public.hospitality_stay_staff_events for select to authenticated using(
 public.hospitality_enabled(organization_id) and public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create trigger hospitality_staff_events_audit after insert on public.hospitality_stay_staff_events for each row execute function public.audit_job_finance_change();

create function public.record_hospitality_shift_staff(p_org uuid,p_branch uuid,p_stay uuid,p_phase text,p_cashier uuid,p_housekeeper uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.hospitality_stay_staff_events; staff public.organization_staff_profiles; cashier_name text; housekeeper_name text;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier']::public.organization_role[]);
 if p_cashier is null or p_housekeeper is null or p_phase is null or p_phase not in('check_in','check_out') then raise exception 'Select the cashier and housekeeper for this shift' using errcode='22023'; end if;
 select * into existing from public.hospitality_stay_staff_events where stay_id=p_stay and phase=p_phase;
 if existing.id is not null then
  if existing.organization_id<>p_org or existing.branch_id<>p_branch or existing.cashier_staff_id<>p_cashier or existing.housekeeper_staff_id<>p_housekeeper then raise exception 'Shift staff were already recorded; refresh the stay' using errcode='40001'; end if;
  return;
 end if;
 -- Stable lock order; renaming/deactivating a profile cannot race this snapshot.
 for staff in select * from public.organization_staff_profiles where organization_id=p_org and id in(p_cashier,p_housekeeper) order by id for share loop
  if not staff.is_active or (exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff.id) and not exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff.id and organization_id=p_org and branch_id=p_branch)) then raise exception 'Select active staff assigned to this branch' using errcode='22023'; end if;
  if staff.id=p_cashier then cashier_name:=staff.full_name; end if;
  if staff.id=p_housekeeper then housekeeper_name:=staff.full_name; end if;
 end loop;
 if cashier_name is null or housekeeper_name is null then raise exception 'Select active staff from this business' using errcode='22023'; end if;
 insert into public.hospitality_stay_staff_events(organization_id,branch_id,stay_id,phase,cashier_staff_id,housekeeper_staff_id,cashier_name,housekeeper_name,recorded_by)
 values(p_org,p_branch,p_stay,p_phase,p_cashier,p_housekeeper,cashier_name,housekeeper_name,auth.uid());
end $$;
revoke all on function public.record_hospitality_shift_staff(uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;

create function public.check_in_hospitality_shift(p_org uuid,p_branch uuid,p_room uuid,p_rate uuid,p_rates_version integer,p_tendered bigint,p_method public.payment_method,p_reference text,p_occupants integer,p_guest_name text,p_guest uuid,p_notes text,p_request uuid,p_final bigint,p_discount_type text,p_discount_card text,p_deposit bigint,p_receipt text,p_cashier uuid,p_housekeeper uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 perform pg_advisory_xact_lock(hashtextextended('hospitality-arrival:'||p_org::text||':'||p_request::text,0));
 select id into sid from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if sid is not null and not exists(select 1 from public.hospitality_stay_staff_events where stay_id=sid and phase='check_in') then raise exception 'Legacy arrival already recorded; refresh' using errcode='40001'; end if;
 sid:=public.check_in_hospitality_cashier(p_org,p_branch,p_room,p_rate,p_rates_version,p_tendered,p_method,p_reference,p_occupants,p_guest_name,p_guest,p_notes,p_request,p_final,p_discount_type,p_discount_card,p_deposit,p_receipt);
 perform public.record_hospitality_shift_staff(p_org,p_branch,sid,'check_in',p_cashier,p_housekeeper);
 return sid;
end $$;
revoke all on function public.check_in_hospitality_shift(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid) from public,anon;
grant execute on function public.check_in_hospitality_shift(uuid,uuid,uuid,uuid,integer,bigint,public.payment_method,text,integer,text,uuid,text,uuid,bigint,text,text,bigint,text,uuid,uuid) to authenticated;

create function public.check_out_hospitality_shift(p_org uuid,p_branch uuid,p_stay uuid,p_acknowledge_debt boolean,p_confirm_refund boolean,p_refund_method public.payment_method,p_refund_reference text,p_cashier uuid,p_housekeeper uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor','cashier']::public.organization_role[]);
 perform 1 from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 if s.checked_out_at is not null and not exists(select 1 from public.hospitality_stay_staff_events where stay_id=s.id and phase='check_out') then raise exception 'Legacy checkout already recorded; refresh' using errcode='40001'; end if;
 perform public.check_out_hospitality_with_deposit(p_org,p_branch,p_stay,p_acknowledge_debt,p_confirm_refund,p_refund_method,p_refund_reference);
 perform public.record_hospitality_shift_staff(p_org,p_branch,p_stay,'check_out',p_cashier,p_housekeeper);
end $$;
revoke all on function public.check_out_hospitality_shift(uuid,uuid,uuid,boolean,boolean,public.payment_method,text,uuid,uuid) from public,anon;
grant execute on function public.check_out_hospitality_shift(uuid,uuid,uuid,boolean,boolean,public.payment_method,text,uuid,uuid) to authenticated;
