-- Shared, branch-scoped customer conversations. Public access is mediated by
-- server-only RPCs; random bearer tokens are never stored in plaintext.
create table public.customer_conversations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 branch_id uuid not null references public.branches(id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 visitor_hash text not null check(visitor_hash ~ '^[a-f0-9]{64}$'),
 customer_name text not null check(char_length(customer_name) between 2 and 80),
 status text not null default 'open' check(status in ('open','closed')),
 needs_reply boolean not null default true,
 customer_message_count integer not null default 0 check(customer_message_count between 0 and 3),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days'
);
create index customer_conversations_inbox on public.customer_conversations(organization_id,branch_id,updated_at desc);
create index customer_conversations_visitor on public.customer_conversations(organization_id,visitor_hash,created_at);
create table public.customer_chat_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
 request_id uuid not null,
 sender text not null check(sender in ('customer','staff')),
 author_user_id uuid references auth.users(id),
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default clock_timestamp(),
 unique(conversation_id,request_id),
 check((sender='customer' and author_user_id is null and char_length(body)<=300) or (sender='staff' and author_user_id is not null))
);
create index customer_chat_messages_thread on public.customer_chat_messages(conversation_id,created_at,id);

create function public.validate_customer_conversation_scope() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.branches where id=new.branch_id and organization_id=new.organization_id) then
  raise exception 'Conversation branch scope mismatch' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.branch_id<>old.branch_id or new.token_hash<>old.token_hash) then
  raise exception 'Conversation scope cannot change' using errcode='23514';
 end if;
 return new;
end $$;
create trigger customer_conversation_scope before insert or update on public.customer_conversations for each row execute function public.validate_customer_conversation_scope();
revoke all on function public.validate_customer_conversation_scope() from public,anon,authenticated;
alter table public.customer_conversations enable row level security;
alter table public.customer_chat_messages enable row level security;
revoke all on public.customer_conversations,public.customer_chat_messages from anon,authenticated;
grant select(id,organization_id,branch_id,customer_name,status,needs_reply,customer_message_count,created_at,updated_at,expires_at) on public.customer_conversations to authenticated;
grant select(id,conversation_id,request_id,sender,body,created_at) on public.customer_chat_messages to authenticated;
create policy customer_conversations_read on public.customer_conversations for select to authenticated
 using(public.has_permission(organization_id,'appointments.manage') and public.can_access_branch(organization_id,branch_id));
create policy customer_chat_messages_read on public.customer_chat_messages for select to authenticated
 using(exists(select 1 from public.customer_conversations c where c.id=conversation_id));

create function public.read_customer_chat(p_slug text,p_token text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.customer_conversations;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Chat unavailable' using errcode='P0002'; end if;
 select x.* into c from public.customer_conversations x
 join public.organizations o on o.id=x.organization_id join public.branches b on b.id=x.branch_id and b.organization_id=o.id
 where x.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and o.slug=p_slug and o.public_page_enabled and o.status='active' and b.is_active and x.expires_at>now();
 if not found then raise exception 'Chat unavailable' using errcode='P0002'; end if;
 return jsonb_build_object('status',c.status,'branchId',c.branch_id,'customerName',c.customer_name,'remaining',3-c.customer_message_count,'expiresAt',c.expires_at,
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender',m.sender,'body',m.body,'createdAt',m.created_at) order by m.created_at,m.id) from public.customer_chat_messages m where m.conversation_id=c.id),'[]'::jsonb));
end $$;

create function public.send_customer_chat(p_slug text,p_token text,p_request_id uuid,p_body text,p_branch_id uuid default null,p_customer_name text default null,p_visitor_hash text default null)
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
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 2 and 80 or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid conversation' using errcode='22023'; end if;
  if not exists(select 1 from public.branches where id=p_branch_id and organization_id=org_id and is_active) then raise exception 'Chat unavailable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_visitor_hash,81));
  if (select count(*) from public.customer_conversations where organization_id=org_id and visitor_hash=p_visitor_hash and created_at>now()-interval '24 hours')>=5 then raise exception 'Conversation limit reached' using errcode='P0003'; end if;
  insert into public.customer_conversations(organization_id,branch_id,token_hash,visitor_hash,customer_name)
   values(org_id,p_branch_id,encode(extensions.digest(p_token,'sha256'),'hex'),p_visitor_hash,btrim(p_customer_name)) returning * into c;
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

create function public.manage_customer_chat(p_id uuid,p_operation text,p_request_id uuid default null,p_body text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.customer_conversations; existing public.customer_chat_messages;
begin
 select * into c from public.customer_conversations where id=p_id for update;
 if not found or not public.has_permission(c.organization_id,'appointments.manage') or not public.can_access_branch(c.organization_id,c.branch_id) then raise exception 'Chat access denied' using errcode='42501'; end if;
 if p_operation='reply' then
  if p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 then raise exception 'Invalid reply' using errcode='22023'; end if;
  select * into existing from public.customer_chat_messages where conversation_id=c.id and request_id=p_request_id;
  if found then
   if existing.sender<>'staff' or existing.author_user_id<>auth.uid() or existing.body<>btrim(p_body) then raise exception 'Retry content changed' using errcode='22023'; end if;
   return;
  end if;
  if c.expires_at<=now() or c.status<>'open' then raise exception 'Conversation closed or expired' using errcode='P0003'; end if;
  if (select count(*) from public.customer_chat_messages where conversation_id=c.id and sender='staff')>=50 then raise exception 'Reply limit reached' using errcode='P0003'; end if;
  insert into public.customer_chat_messages(conversation_id,request_id,sender,author_user_id,body) values(c.id,p_request_id,'staff',auth.uid(),btrim(p_body));
  update public.customer_conversations set needs_reply=false,updated_at=clock_timestamp() where id=c.id;
 elsif p_operation in ('close','reopen') then
  if p_operation='reopen' and c.expires_at<=now() then raise exception 'Conversation expired' using errcode='P0003'; end if;
  update public.customer_conversations set status=case when p_operation='close' then 'closed' else 'open' end,needs_reply=case when p_operation='close' then false else needs_reply end,updated_at=clock_timestamp() where id=c.id;
 else raise exception 'Invalid operation' using errcode='22023'; end if;
end $$;
revoke all on function public.read_customer_chat(text,text),public.send_customer_chat(text,text,uuid,text,uuid,text,text),public.manage_customer_chat(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.read_customer_chat(text,text),public.send_customer_chat(text,text,uuid,text,uuid,text,text) to service_role;
grant execute on function public.manage_customer_chat(uuid,text,uuid,text) to authenticated;
