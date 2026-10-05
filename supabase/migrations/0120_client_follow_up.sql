begin;

create table public.client_reminders (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 branch_id uuid not null,
 customer_id uuid not null,
 reason text not null check(char_length(btrim(reason)) between 1 and 500),
 due_at timestamptz not null check(isfinite(due_at)),
 status text not null default 'pending' check(status in ('pending','contacted','cancelled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 check((status='pending')=(resolved_at is null))
);
create index client_reminders_due on public.client_reminders(organization_id,due_at,id) where status='pending';
create index client_reminders_customer on public.client_reminders(organization_id,customer_id,due_at,id);
alter table public.client_reminders enable row level security;
revoke all on public.client_reminders from public,anon,authenticated;
grant select on public.client_reminders to authenticated;
create policy client_reminders_read on public.client_reminders for select to authenticated using(
 public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id)
);

create function public.create_client_reminder(p_id uuid,p_branch uuid,p_customer uuid,p_reason text,p_due timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; existing public.client_reminders;
begin
 select organization_id into org from public.branches where id=p_branch and is_active;
 if auth.uid() is null or org is null or not public.has_org_role(org,array['owner','manager','advisor']::public.organization_role[])
 or not public.can_access_branch(org,p_branch) then raise exception 'Access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.customers where id=p_customer and organization_id=org and not is_archived)
 or p_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 or p_due is null or not isfinite(p_due)
 then raise exception 'Invalid reminder' using errcode='22023'; end if;
 insert into public.client_reminders(id,organization_id,branch_id,customer_id,reason,due_at,created_by)
 values(p_id,org,p_branch,p_customer,btrim(p_reason),p_due,auth.uid()) on conflict(id) do nothing;
 select * into existing from public.client_reminders where id=p_id;
 if existing.organization_id<>org or existing.branch_id<>p_branch or existing.customer_id<>p_customer
 or existing.reason<>btrim(p_reason) or existing.due_at<>p_due or existing.created_by<>auth.uid()
 then raise exception 'Request key reused with different details' using errcode='22023'; end if;
 return p_id;
end $$;

create function public.resolve_client_reminder(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.client_reminders;
begin
 select * into r from public.client_reminders where id=p_id for update;
 if auth.uid() is null or r.id is null or not public.has_org_role(r.organization_id,array['owner','manager','advisor']::public.organization_role[])
 or not public.can_access_branch(r.organization_id,r.branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('contacted','cancelled') then raise exception 'Invalid reminder status' using errcode='22023'; end if;
 if r.status=p_status then return; end if;
 if r.status<>'pending' then raise exception 'Reminder already resolved' using errcode='22023'; end if;
 update public.client_reminders set status=p_status,resolved_at=now() where id=p_id;
end $$;

create index checkout_handover_history on public.checkout_operations(organization_id,(payload->>3),created_at)
 where payload->>0='fulfillment' and payload->>5='handover';

-- Narrow CRM projection: no stock costs, margins, or unrestricted checkout access.
-- Draft/voided retail lines are excluded. Promo inclusions appear after handover.
create function public.client_product_history(p_customer uuid,p_offset integer default 0)
returns table(id uuid,name text,quantity numeric,unit text,returned numeric,purchased_at timestamptz,branch_name text,payment_status text,promo_name text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
 select organization_id into org from public.customers where customers.id=p_customer;
 if auth.uid() is null or org is null or not public.is_org_member(org) then raise exception 'Access denied' using errcode='42501'; end if;
 return query select l.id,l.name,case when l.included_key is not null then l.handed_over else l.quantity end,l.unit,l.returned,coalesce(i.issued_at,h.handed_at,l.created_at),b.name,
 case when l.included_key is not null then 'Promo inclusion' else i.status::text end,l.promo_name
 from public.checkouts c join public.checkout_lines l on l.checkout_id=c.id
 join public.branches b on b.id=c.branch_id and b.organization_id=c.organization_id
 left join public.invoices i on i.id=l.invoice_id and i.organization_id=c.organization_id and i.branch_id=c.branch_id
 left join lateral (select min(o.created_at) as handed_at from public.checkout_operations o
 where o.organization_id=c.organization_id and o.payload->>0='fulfillment' and o.payload->>5='handover' and o.payload->>3=l.id::text) h on l.included_key is not null
 where c.organization_id=org and c.customer_id=p_customer and public.can_access_branch(org,c.branch_id)
 and l.removed_at is null and ((l.included_key is null and i.status in ('issued','partially_paid','paid')) or (l.included_key is not null and l.handed_over>0))
 order by coalesce(i.issued_at,h.handed_at,l.created_at) desc,l.id limit 21 offset greatest(0,least(coalesce(p_offset,0),1000000));
end $$;
revoke all on function public.create_client_reminder(uuid,uuid,uuid,text,timestamptz),public.resolve_client_reminder(uuid,text),public.client_product_history(uuid,integer) from public,anon;
grant execute on function public.create_client_reminder(uuid,uuid,uuid,text,timestamptz),public.resolve_client_reminder(uuid,text),public.client_product_history(uuid,integer) to authenticated;
commit;
