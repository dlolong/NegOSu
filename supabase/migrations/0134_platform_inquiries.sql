begin;
create table public.platform_inquiries (
 id uuid primary key,
 name text not null check (char_length(btrim(name)) between 2 and 120),
 email text not null check (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 subject text not null check (char_length(btrim(subject)) between 3 and 160),
 message text not null check (char_length(btrim(message)) between 10 and 5000),
 status text not null default 'new' check (status in ('new','closed')),
 created_at timestamptz not null default now()
);
alter table public.platform_inquiries enable row level security;
revoke all on public.platform_inquiries from public, anon, authenticated;
grant select, insert, update on public.platform_inquiries to service_role;
create index platform_inquiries_received on public.platform_inquiries(created_at desc,id);
create index platform_inquiries_email on public.platform_inquiries(email,created_at desc);

-- Trusted server only. Anonymous callers cannot read or write the table directly.
-- Serialize intake to enforce limits even under concurrent requests.
create function public.submit_platform_inquiry(p_id uuid,p_name text,p_email text,p_subject text,p_message text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.platform_inquiries;
begin
 perform pg_advisory_xact_lock(134,1);
 select * into existing from public.platform_inquiries where id=p_id;
 if found then
  if existing.name=btrim(p_name) and existing.email=lower(btrim(p_email)) and existing.subject=btrim(p_subject) and existing.message=btrim(p_message) then return; end if;
  raise exception 'Request key reused' using errcode='22023';
 end if;
 if (select count(*) from public.platform_inquiries where email=lower(btrim(p_email)) and created_at>now()-interval '1 hour')>=3
 or (select count(*) from public.platform_inquiries where created_at>now()-interval '1 hour')>=100
 then raise exception 'Submission limit reached' using errcode='P0001'; end if;
 insert into public.platform_inquiries(id,name,email,subject,message)
 values(p_id,btrim(p_name),lower(btrim(p_email)),btrim(p_subject),btrim(p_message));
end $$;
revoke all on function public.submit_platform_inquiry(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_platform_inquiry(uuid,text,text,text,text) to service_role;
commit;
