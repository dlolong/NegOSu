-- Contact details are private to the existing tenant/branch-scoped staff inbox.
-- Existing conversations may retain null contacts and continue receiving replies.
alter table public.customer_conversations
 add column customer_phone text,
 add column customer_email text,
 add constraint customer_chat_phone_valid check(customer_phone is null or customer_phone ~ '^\+?[0-9]{10,15}$'),
 add constraint customer_chat_email_valid check(customer_email is null or (char_length(customer_email)<=254 and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
grant select(customer_phone,customer_email) on public.customer_conversations to authenticated;

create function public.validate_customer_chat_contact() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.customer_phone is null and new.customer_email is null then
  if tg_op='INSERT' then raise exception 'Contact details required' using errcode='23514'; end if;
  if old.customer_phone is not null or old.customer_email is not null then raise exception 'Contact details required' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function public.validate_customer_chat_contact() from public,anon,authenticated;
create trigger customer_chat_contact before insert or update on public.customer_conversations for each row execute function public.validate_customer_chat_contact();

-- Replace the old signature, so it cannot create conversations without contact.
-- Default arguments retain existing read/send and retry behavior for old threads.
drop function public.send_customer_chat(text,text,uuid,text,uuid,text,text);
create function public.send_customer_chat(p_slug text,p_token text,p_request_id uuid,p_body text,p_branch_id uuid default null,p_customer_name text default null,p_visitor_hash text default null,p_customer_phone text default null,p_customer_email text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.customer_conversations; org_id uuid; existing public.customer_chat_messages;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 300 then raise exception 'Invalid message' using errcode='22023'; end if;
 select id into org_id from public.organizations where slug=p_slug and public_page_enabled and status='active';
 if org_id is null then raise exception 'Chat unavailable' using errcode='P0002'; end if;
 -- Serializes first-message retries, including before a conversation row exists.
 perform pg_advisory_xact_lock(hashtextextended(p_token,80));
 select * into c from public.customer_conversations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then
  p_customer_phone := nullif(regexp_replace(btrim(p_customer_phone),'[ ()-]','','g'),'');
  p_customer_email := nullif(btrim(p_customer_email),'');
  if p_customer_phone is null and p_customer_email is null then raise exception 'Contact details required' using errcode='22023'; end if;
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 2 and 80 or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid conversation' using errcode='22023'; end if;
  if not exists(select 1 from public.branches where id=p_branch_id and organization_id=org_id and is_active) then raise exception 'Chat unavailable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_visitor_hash,81));
  if (select count(*) from public.customer_conversations where organization_id=org_id and visitor_hash=p_visitor_hash and created_at>now()-interval '24 hours')>=5 then raise exception 'Conversation limit reached' using errcode='P0003'; end if;
  insert into public.customer_conversations(organization_id,branch_id,token_hash,visitor_hash,customer_name,customer_phone,customer_email)
   values(org_id,p_branch_id,encode(extensions.digest(p_token,'sha256'),'hex'),p_visitor_hash,btrim(p_customer_name),p_customer_phone,p_customer_email) returning * into c;
 end if;
 if c.organization_id<>org_id or c.expires_at<=now() or not exists(select 1 from public.branches where id=c.branch_id and organization_id=org_id and is_active) then raise exception 'Chat unavailable' using errcode='P0002'; end if;
 select * into existing from public.customer_chat_messages where conversation_id=c.id and request_id=p_request_id;
 if found then
  if existing.sender<>'customer' or existing.body<>btrim(p_body) then raise exception 'Retry content changed' using errcode='22023'; end if;
  return public.read_customer_chat(p_slug,p_token);
 end if;
 if c.status<>'open' or c.customer_message_count>=3 then raise exception 'Message limit reached or conversation closed' using errcode='P0003'; end if;
 insert into public.customer_chat_messages(conversation_id,request_id,sender,body) values(c.id,p_request_id,'customer',btrim(p_body));
 update public.customer_conversations set customer_message_count=customer_message_count+1,needs_reply=true,updated_at=clock_timestamp() where id=c.id;
 return public.read_customer_chat(p_slug,p_token);
end $$;

revoke all on function public.send_customer_chat(text,text,uuid,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.send_customer_chat(text,text,uuid,text,uuid,text,text,text,text) to service_role;
