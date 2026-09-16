alter table public.organizations drop constraint organizations_industry_check;
alter table public.organizations add constraint organizations_industry_check check(industry in('automotive','salon','pet_care','hospitality'));
-- Controlled pilot: only trusted operators grant invitations/enable organizations.
create table public.hospitality_pilot_users(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table public.hospitality_pilot_organizations(organization_id uuid primary key references public.organizations(id) on delete cascade,creator_id uuid unique references auth.users(id),created_at timestamptz not null default now());
alter table public.hospitality_pilot_users enable row level security;
alter table public.hospitality_pilot_organizations enable row level security;
revoke all on public.hospitality_pilot_users,public.hospitality_pilot_organizations from anon,authenticated;
grant select on public.hospitality_pilot_users to authenticated;
create policy hospitality_own_invite on public.hospitality_pilot_users for select to authenticated using(user_id=auth.uid());
create function public.hospitality_enabled(p_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.organizations o join public.hospitality_pilot_organizations p on p.organization_id=o.id where o.id=p_org and o.industry='hospitality' and o.status='active'); $$;
revoke all on function public.hospitality_enabled(uuid) from public,anon;
grant execute on function public.hospitality_enabled(uuid) to authenticated;

create function public.create_hospitality_pilot(p_name text,p_branch_name text,p_request uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; branch uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.hospitality_pilot_users where user_id=auth.uid()) then raise exception 'Pilot invitation required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hospitality-pilot:'||auth.uid()::text,0));
 select organization_id into org from public.hospitality_pilot_organizations where creator_id=auth.uid();
 if org is not null then return org; end if;
 if p_request is null or nullif(trim(p_name),'') is null or char_length(p_name)>120 or nullif(trim(p_branch_name),'') is null or char_length(p_branch_name)>120 then raise exception 'Business and branch names required' using errcode='22023'; end if;
 insert into public.profiles(id) values(auth.uid()) on conflict do nothing;
 insert into public.organizations(name,industry,slug,currency,timezone,created_by) values(trim(p_name),'hospitality','inn-'||replace(gen_random_uuid()::text,'-',''),'PHP','Asia/Manila',auth.uid()) returning id into org;
 insert into public.organization_memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
 insert into public.organization_subscriptions(organization_id,plan_id,status) values(org,'free','free');
 insert into public.branches(organization_id,name,is_primary,timezone) values(org,trim(p_branch_name),true,'Asia/Manila') returning id into branch;
 insert into public.hospitality_pilot_organizations(organization_id,creator_id) values(org,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(org,auth.uid(),'organization',org,'organization.created',jsonb_build_object('industry','hospitality','pilot',true));
 return org;
end $$;
revoke all on function public.create_hospitality_pilot(text,text,uuid) from public,anon;
grant execute on function public.create_hospitality_pilot(text,text,uuid) to authenticated;

alter table public.branches add constraint branches_hospitality_tenant_key unique(organization_id,id);
alter table public.customers add constraint customers_hospitality_tenant_key unique(organization_id,id);
create table public.hospitality_rooms(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,
 name text not null check(char_length(trim(name)) between 1 and 80),room_type text check(char_length(room_type)<=80),description text check(char_length(description)<=1000),
 capacity integer not null check(capacity between 1 and 100),is_active boolean not null default true,
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id) on delete restrict,
 unique(organization_id,branch_id,id));
create unique index hospitality_room_branch_name on public.hospitality_rooms(branch_id,lower(trim(name)));
create table public.hospitality_stays(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,room_id uuid not null,guest_id uuid not null,
 room_name_snapshot text not null,guest_name_snapshot text not null,occupants integer not null check(occupants between 1 and 100),notes text check(char_length(notes)<=2000),
 checked_in_at timestamptz not null default now(),checked_out_at timestamptz,created_by uuid references auth.users(id),checked_out_by uuid references auth.users(id),
 request_key uuid not null,
 foreign key(organization_id,branch_id,room_id) references public.hospitality_rooms(organization_id,branch_id,id) on delete restrict,
 foreign key(organization_id,guest_id) references public.customers(organization_id,id) on delete restrict,
 check(checked_out_at is null or checked_out_at>=checked_in_at),unique(organization_id,request_key),unique(organization_id,branch_id,id));
create unique index hospitality_one_active_stay on public.hospitality_stays(room_id) where checked_out_at is null;
create index hospitality_stay_guest on public.hospitality_stays(organization_id,guest_id,checked_in_at desc);
create index hospitality_stay_branch on public.hospitality_stays(branch_id,checked_in_at desc);
create table public.hospitality_stay_bills(
 organization_id uuid not null,branch_id uuid not null,stay_id uuid primary key,invoice_id uuid not null unique,checkout_debt_acknowledged boolean not null default false,
 foreign key(organization_id,branch_id,stay_id) references public.hospitality_stays(organization_id,branch_id,id) on delete restrict,
 foreign key(organization_id,branch_id,invoice_id) references public.invoices(organization_id,branch_id,id) on delete restrict);

create function public.assert_hospitality_access(p_org uuid,p_branch uuid,p_roles public.organization_role[]) returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.hospitality_enabled(p_org) or not public.has_org_role(p_org,p_roles) or not public.can_access_branch(p_org,p_branch) or not exists(select 1 from public.branches where id=p_branch and organization_id=p_org and is_active) then raise exception 'Hospitality access denied' using errcode='42501'; end if;
end $$;
revoke all on function public.assert_hospitality_access(uuid,uuid,public.organization_role[]) from public,anon,authenticated;

alter table public.hospitality_rooms enable row level security;
alter table public.hospitality_stays enable row level security;
alter table public.hospitality_stay_bills enable row level security;
revoke all on public.hospitality_rooms,public.hospitality_stays,public.hospitality_stay_bills from anon,authenticated;
grant select on public.hospitality_rooms,public.hospitality_stays,public.hospitality_stay_bills to authenticated;
create policy hospitality_room_read on public.hospitality_rooms for select to authenticated using(public.hospitality_enabled(organization_id) and public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create policy hospitality_stay_read on public.hospitality_stays for select to authenticated using(public.hospitality_enabled(organization_id) and public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create policy hospitality_bill_read on public.hospitality_stay_bills for select to authenticated using(public.hospitality_enabled(organization_id) and public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]) and public.can_access_branch(organization_id,branch_id));
create trigger hospitality_room_audit after insert or update or delete on public.hospitality_rooms for each row execute function public.audit_job_finance_change();
create trigger hospitality_stay_audit after insert or update or delete on public.hospitality_stays for each row execute function public.audit_job_finance_change();
create trigger hospitality_room_updated before update on public.hospitality_rooms for each row execute function public.set_updated_at();

create function public.save_hospitality_room(p_org uuid,p_branch uuid,p_room uuid,p_name text,p_type text,p_description text,p_capacity integer,p_active boolean) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.hospitality_rooms; rid uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager']::public.organization_role[]);
 if p_room is not null then
 select * into r from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 if r.id is null then raise exception 'Room not found' using errcode='42501'; end if;
 if exists(select 1 from public.hospitality_stays where room_id=r.id and checked_out_at is null and (not p_active or occupants>p_capacity)) then raise exception 'Occupied room cannot be deactivated or made too small' using errcode='22023'; end if;
 update public.hospitality_rooms set name=trim(p_name),room_type=nullif(trim(p_type),''),description=nullif(trim(p_description),''),capacity=p_capacity,is_active=p_active where id=r.id returning id into rid;
 else
 insert into public.hospitality_rooms(organization_id,branch_id,name,room_type,description,capacity,is_active,created_by) values(p_org,p_branch,trim(p_name),nullif(trim(p_type),''),nullif(trim(p_description),''),p_capacity,p_active,auth.uid()) returning id into rid;
 end if; return rid;
end $$;

create function public.add_hospitality_charge(p_org uuid,p_branch uuid,p_stay uuid,p_description text,p_quantity integer,p_unit_centavos bigint,p_request uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays; bill uuid;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','cashier']::public.organization_role[]);
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 select invoice_id into bill from public.hospitality_stay_bills where stay_id=s.id;
 if bill is null then
 bill:=public.create_manual_invoice(p_org,p_branch,s.guest_name_snapshot);
 insert into public.hospitality_stay_bills(organization_id,branch_id,stay_id,invoice_id) values(p_org,p_branch,s.id,bill);
 end if;
 return public.add_manual_invoice_charge(bill,p_description,p_quantity,p_unit_centavos,p_request);
end $$;

create function public.check_in_hospitality(p_org uuid,p_branch uuid,p_room uuid,p_guest uuid,p_occupants integer,p_notes text,p_charge_centavos bigint,p_request uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.hospitality_rooms; guest public.customers; existing public.hospitality_stays; sid uuid; original_charge bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor']::public.organization_role[]);
 if p_request is null then raise exception 'Request key required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_request::text,0));
 select * into existing from public.hospitality_stays where organization_id=p_org and request_key=p_request;
 if existing.id is not null then
 select ii.unit_price_centavos into original_charge from public.hospitality_stay_bills sb join public.invoice_items ii on ii.invoice_id=sb.invoice_id and ii.request_key=p_request where sb.stay_id=existing.id;
 if existing.branch_id<>p_branch or existing.room_id<>p_room or existing.guest_id<>p_guest or existing.occupants<>p_occupants or existing.notes is distinct from nullif(trim(p_notes),'') or original_charge is distinct from p_charge_centavos then raise exception 'Request key already used with different check-in' using errcode='22023'; end if;
 return existing.id; end if;
 select * into r from public.hospitality_rooms where id=p_room and organization_id=p_org and branch_id=p_branch for update;
 select * into guest from public.customers where id=p_guest and organization_id=p_org and not is_archived;
 if r.id is null or guest.id is null then raise exception 'Room or guest unavailable' using errcode='42501'; end if;
 if not r.is_active or exists(select 1 from public.hospitality_stays where room_id=r.id and checked_out_at is null) then raise exception 'Room is no longer vacant' using errcode='23505'; end if;
 if p_occupants is null or p_occupants<1 or p_occupants>r.capacity then raise exception 'Occupants exceed room capacity' using errcode='22023'; end if;
 insert into public.hospitality_stays(organization_id,branch_id,room_id,guest_id,room_name_snapshot,guest_name_snapshot,occupants,notes,created_by,request_key)
 values(p_org,p_branch,r.id,guest.id,r.name,guest.full_name,p_occupants,nullif(trim(p_notes),''),auth.uid(),p_request) returning id into sid;
 if p_charge_centavos is not null then perform public.add_hospitality_charge(p_org,p_branch,sid,'Accommodation',1,p_charge_centavos,p_request); end if;
 return sid;
end $$;

create function public.check_out_hospitality(p_org uuid,p_branch uuid,p_stay uuid,p_acknowledge_debt boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hospitality_stays; amount bigint;
begin
 perform public.assert_hospitality_access(p_org,p_branch,array['owner','manager','advisor']::public.organization_role[]);
 -- Lock order: room, stay, invoice. Same order as check-in and room edits.
 perform 1 from public.hospitality_rooms where id=(select room_id from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch) for update;
 select * into s from public.hospitality_stays where id=p_stay and organization_id=p_org and branch_id=p_branch for update;
 if s.id is null then raise exception 'Stay not found' using errcode='42501'; end if;
 if s.checked_out_at is not null then return; end if;
 select i.balance_centavos into amount from public.hospitality_stay_bills sb join public.invoices i on i.id=sb.invoice_id where sb.stay_id=s.id and i.status<>'void' for update of i;
 if coalesce(amount,0)>0 and not coalesce(p_acknowledge_debt,false) then raise exception 'Acknowledge the outstanding balance before checkout' using errcode='22023'; end if;
 update public.hospitality_stays set checked_out_at=now(),checked_out_by=auth.uid() where id=s.id;
 update public.hospitality_stay_bills set checkout_debt_acknowledged=coalesce(amount,0)>0 where stay_id=s.id;
end $$;

revoke all on function public.save_hospitality_room(uuid,uuid,uuid,text,text,text,integer,boolean),public.add_hospitality_charge(uuid,uuid,uuid,text,integer,bigint,uuid),public.check_in_hospitality(uuid,uuid,uuid,uuid,integer,text,bigint,uuid),public.check_out_hospitality(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.save_hospitality_room(uuid,uuid,uuid,text,text,text,integer,boolean),public.add_hospitality_charge(uuid,uuid,uuid,text,integer,bigint,uuid),public.check_in_hospitality(uuid,uuid,uuid,uuid,integer,text,bigint,uuid),public.check_out_hospitality(uuid,uuid,uuid,boolean) to authenticated;

create view public.hospitality_guest_rooms with(security_invoker=true) as
 select organization_id,guest_id,array_to_string((array_agg(room_name_snapshot order by room_name_snapshot))[1:10],', ') room_names,count(*) room_count
 from public.hospitality_stays where checked_out_at is null group by organization_id,guest_id;
revoke all on public.hospitality_guest_rooms from public,anon;
grant select on public.hospitality_guest_rooms to authenticated;
