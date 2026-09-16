begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10800000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-owner@example.test','',now(),'{}','{}',now(),now()),
('10800000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-foreign@example.test','',now(),'{}','{}',now(),now()),
('10800000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-restricted@example.test','',now(),'{}','{}',now(),now()),
('10800000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-viewer@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,industry,public_page_enabled) values
('20800000-0000-4000-8000-000000000001','Chat Auto','chat-auto-test','automotive',true),
('20800000-0000-4000-8000-000000000002','Chat Salon','chat-salon-test','salon',true),
('20800000-0000-4000-8000-000000000003','Chat Pet','chat-pet-test','pet_care',true);
insert into organization_subscriptions(organization_id,plan_id,status) values('20800000-0000-4000-8000-000000000001','business','active');
insert into branches(id,organization_id,name,is_primary) values
('40800000-0000-4000-8000-000000000001','20800000-0000-4000-8000-000000000001','Auto Main',true),
('40800000-0000-4000-8000-000000000002','20800000-0000-4000-8000-000000000001','Auto Other',false),
('40800000-0000-4000-8000-000000000003','20800000-0000-4000-8000-000000000002','Salon',true),
('40800000-0000-4000-8000-000000000004','20800000-0000-4000-8000-000000000003','Pet',true);
insert into organization_memberships(id,organization_id,user_id,role) values
('30800000-0000-4000-8000-000000000001','20800000-0000-4000-8000-000000000001','10800000-0000-4000-8000-000000000001','owner'),
('30800000-0000-4000-8000-000000000002','20800000-0000-4000-8000-000000000002','10800000-0000-4000-8000-000000000002','owner'),
('30800000-0000-4000-8000-000000000003','20800000-0000-4000-8000-000000000001','10800000-0000-4000-8000-000000000003','advisor'),
('30800000-0000-4000-8000-000000000004','20800000-0000-4000-8000-000000000001','10800000-0000-4000-8000-000000000004','viewer');
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values('20800000-0000-4000-8000-000000000001','30800000-0000-4000-8000-000000000003','40800000-0000-4000-8000-000000000002');
create function pg_temp.send_chat(p_request integer,p_body text default 'Hello',p_token text default repeat('a',64)) returns jsonb language sql as $$
 select public.send_customer_chat('chat-auto-test',p_token,('50800000-0000-4000-8000-'||lpad(p_request::text,12,'0'))::uuid,p_body,'40800000-0000-4000-8000-000000000001','Customer',repeat('b',64))
$$;
select is((pg_temp.send_chat(1)->>'remaining')::integer,2,'first message starts conversation');
select is((pg_temp.send_chat(1)->>'remaining')::integer,2,'retry does not consume another message');
select throws_ok($$select pg_temp.send_chat(1,'Changed')$$,'22023',null,'request identity cannot change content');
select throws_ok($$select pg_temp.send_chat(2,repeat('x',301))$$,'22023',null,'customer limit enforced on server');
select throws_ok($$select pg_temp.send_chat(2,'   ')$$,'22023',null,'blank message denied');
select throws_ok($$select read_customer_chat('chat-salon-test',repeat('a',64))$$,'P0002',null,'token cannot be used with another business');
select throws_ok($$select read_customer_chat('chat-auto-test',repeat('f',64))$$,'P0002',null,'unknown token denied');
select throws_ok($$select send_customer_chat('chat-auto-test',repeat('c',64),gen_random_uuid(),'Hello','40800000-0000-4000-8000-000000000003','Customer',repeat('b',64))$$,'P0002',null,'foreign branch rejected');
select lives_ok($$select send_customer_chat('chat-salon-test',repeat('c',64),gen_random_uuid(),'Hello','40800000-0000-4000-8000-000000000003','Salon Customer',repeat('b',64))$$,'Salon shares chat capability');
select lives_ok($$select send_customer_chat('chat-pet-test',repeat('d',64),gen_random_uuid(),'Hello','40800000-0000-4000-8000-000000000004','Pet Customer',repeat('b',64))$$,'Pet Care shares chat capability');
create temporary table chat_test_id as select id from customer_conversations where token_hash=encode(extensions.digest(repeat('a',64),'sha256'),'hex');
grant select on chat_test_id to authenticated;
select ok((select relrowsecurity from pg_class where oid='customer_conversations'::regclass),'conversation RLS enabled');
select ok((select relrowsecurity from pg_class where oid='customer_chat_messages'::regclass),'message RLS enabled');
set local role anon;
select throws_ok($$select id from customer_conversations$$,'42501',null,'anonymous table access denied');
select throws_ok($$select body from customer_chat_messages$$,'42501',null,'anonymous messages denied');
select throws_ok($$select read_customer_chat('chat-auto-test',repeat('a',64))$$,'42501',null,'public RPC cannot bypass server gateway');
reset role;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10800000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from customer_conversations where id=(select id from chat_test_id)),0::bigint,'foreign tenant cannot see conversation');
select is((select count(*) from customer_chat_messages where conversation_id=(select id from chat_test_id)),0::bigint,'foreign tenant cannot see messages');
select throws_ok($$select manage_customer_chat((select id from chat_test_id),'reply',gen_random_uuid(),'Foreign')$$,'42501',null,'foreign tenant cannot reply');
set local "request.jwt.claims"='{"sub":"10800000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from customer_conversations where id=(select id from chat_test_id)),0::bigint,'restricted branch cannot read');
select throws_ok($$select manage_customer_chat((select id from chat_test_id),'close')$$,'42501',null,'restricted branch cannot close');
set local "request.jwt.claims"='{"sub":"10800000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from customer_conversations),0::bigint,'viewer cannot read inbox');
select throws_ok($$select manage_customer_chat((select id from chat_test_id),'reply',gen_random_uuid(),'Viewer')$$,'42501',null,'viewer cannot reply');
set local "request.jwt.claims"='{"sub":"10800000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from customer_conversations where id=(select id from chat_test_id)),1::bigint,'owner reads own conversation');
select throws_ok($$select token_hash from customer_conversations$$,'42501',null,'inbox does not expose token hashes');
select throws_ok($$insert into customer_chat_messages(conversation_id,request_id,sender,body) values((select id from chat_test_id),gen_random_uuid(),'customer','Injected')$$,'42501',null,'staff cannot forge a customer message');
select lives_ok($$select manage_customer_chat((select id from chat_test_id),'reply','50800000-0000-4000-8000-000000000099','Please choose a service to book.')$$,'owner replies');
select lives_ok($$select manage_customer_chat((select id from chat_test_id),'reply','50800000-0000-4000-8000-000000000099','Please choose a service to book.')$$,'staff reply retry is idempotent');
select is((select count(*) from customer_chat_messages where conversation_id=(select id from chat_test_id) and sender='staff'),1::bigint,'one staff reply persisted');
select is((select needs_reply from customer_conversations where id=(select id from chat_test_id)),false,'reply clears needs-reply flag');
select lives_ok($$select manage_customer_chat((select id from chat_test_id),'close')$$,'owner closes conversation');
reset role;
select throws_ok($$select pg_temp.send_chat(2)$$,'P0003',null,'closed chat blocks new customer message');
select is(read_customer_chat('chat-auto-test',repeat('a',64))->'messages'->1->>'sender','staff','customer sees business reply');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10800000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select manage_customer_chat((select id from chat_test_id),'reopen')$$,'owner reopens conversation');
reset role;
select is((pg_temp.send_chat(2)->>'remaining')::integer,1,'second customer message accepted');
select is((pg_temp.send_chat(3)->>'remaining')::integer,0,'third customer message accepted');
select throws_ok($$select pg_temp.send_chat(4)$$,'P0003',null,'fourth customer message denied');
select is((select needs_reply from customer_conversations where id=(select id from chat_test_id)),true,'customer follow-up requires reply');
select lives_ok($$select pg_temp.send_chat(10,'Hello',repeat('1',64))$$,'second thread allowed');
select lives_ok($$select pg_temp.send_chat(11,'Hello',repeat('2',64))$$,'third thread allowed');
select lives_ok($$select pg_temp.send_chat(12,'Hello',repeat('3',64))$$,'fourth thread allowed');
select lives_ok($$select pg_temp.send_chat(13,'Hello',repeat('4',64))$$,'fifth thread allowed');
select throws_ok($$select pg_temp.send_chat(14,'Hello',repeat('5',64))$$,'P0003',null,'sixth thread per visitor/day denied');
update organizations set public_page_enabled=false where id='20800000-0000-4000-8000-000000000001';
select throws_ok($$select read_customer_chat('chat-auto-test',repeat('a',64))$$,'P0002',null,'unpublished business closes public access');
update organizations set public_page_enabled=true where id='20800000-0000-4000-8000-000000000001';
update customer_conversations set expires_at=now()-interval '1 second' where id=(select id from chat_test_id);
select throws_ok($$select read_customer_chat('chat-auto-test',repeat('a',64))$$,'P0002',null,'expired conversation not readable publicly');
select throws_ok($$select pg_temp.send_chat(1)$$,'P0002',null,'expired conversation cannot be revived by retry');
select * from finish();
rollback;
