begin;
-- Preserve private storage, service-only access and the existing serialized hourly limits.
create or replace function public.submit_platform_inquiry(p_id uuid,p_name text,p_email text,p_subject text,p_message text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.platform_inquiries;
begin
 perform pg_advisory_xact_lock(134,1);
 select * into existing from public.platform_inquiries where id=p_id;
 if found then
  if existing.name=btrim(p_name) and existing.email=lower(btrim(p_email)) and existing.subject=btrim(p_subject) and existing.message=btrim(p_message) then return; end if;
  raise exception 'Request key reused' using errcode='22023';
 end if;
 -- Deduplicate across reloads/new request IDs. Never return stored inquiry data.
 if exists(select 1 from public.platform_inquiries where email=lower(btrim(p_email))
   and subject=btrim(p_subject) and message=btrim(p_message)
   and created_at>now()-interval '24 hours') then return; end if;
 if exists(select 1 from public.platform_inquiries where email=lower(btrim(p_email))
   and created_at>now()-interval '1 minute')
 then raise exception 'Submission cooldown' using errcode='P0001'; end if;
 if (select count(*) from public.platform_inquiries where email=lower(btrim(p_email)) and created_at>now()-interval '1 hour')>=3
 or (select count(*) from public.platform_inquiries where created_at>now()-interval '1 hour')>=100
 then raise exception 'Submission limit reached' using errcode='P0001'; end if;
 insert into public.platform_inquiries(id,name,email,subject,message)
 values(p_id,btrim(p_name),lower(btrim(p_email)),btrim(p_subject),btrim(p_message));
end $$;
revoke all on function public.submit_platform_inquiry(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_platform_inquiry(uuid,text,text,text,text) to service_role;
commit;
