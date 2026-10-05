begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
set local "request.jwt.claims"='{"role":"service_role"}';

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('c0100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','commerce-owner@example.test','',now(),'{}','{}',now(),now()),
('c0100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','commerce-outsider@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,industry) values
('c0200000-0000-4000-8000-000000000001','Commerce Salon','commerce-salon-test','salon'),
('c0200000-0000-4000-8000-000000000002','Other Business','commerce-other-test','automotive');
insert into organization_memberships(organization_id,user_id,role) values
('c0200000-0000-4000-8000-000000000001','c0100000-0000-4000-8000-000000000001','owner'),
('c0200000-0000-4000-8000-000000000002','c0100000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,is_primary) values
('c0300000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','Main',true),
('c0300000-0000-4000-8000-000000000002','c0200000-0000-4000-8000-000000000002','Other',true);

insert into branches(id,organization_id,name) values
('c0300000-0000-4000-8000-000000000003','c0200000-0000-4000-8000-000000000001','Restricted');
insert into customers(id,organization_id,full_name) values
('c0800000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','Client'),
('c0800000-0000-4000-8000-000000000002','c0200000-0000-4000-8000-000000000002','Other Client');
create function pg_temp.remind(p_reason text default 'Facial follow-up',p_branch uuid default 'c0300000-0000-4000-8000-000000000001',p_customer uuid default 'c0800000-0000-4000-8000-000000000001') returns uuid language sql as $$
 select public.create_client_reminder('c0700000-0000-4000-8000-000000000001',p_branch,p_customer,p_reason,'2026-10-05T06:30:00Z');
$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select pg_temp.remind()$$,'create manual reminder');
select is((select count(*) from client_product_history_filtered('c0800000-0000-4000-8000-000000000001',0,'cream','2026-01-01','2027-01-01')),0::bigint,'filtered history handles empty result');
select is(pg_temp.remind(),pg_temp.remind(),'exact retry returns the same reminder');
select is((select count(*) from client_reminders),1::bigint,'retry creates no duplicate');
select throws_ok($$select pg_temp.remind('Changed')$$,'22023','Request key reused with different details','changed retry rejected');
select throws_ok($$select pg_temp.remind(' ')$$,'22023','Invalid reminder','blank reason rejected');
select throws_ok($$select pg_temp.remind(repeat('a',501))$$,'22023','Invalid reminder','oversized reason rejected');
select throws_ok($$select pg_temp.remind('Reason','c0300000-0000-4000-8000-000000000001','c0800000-0000-4000-8000-000000000002')$$,'22023','Invalid reminder','cross-tenant customer rejected');
select throws_ok($$update client_reminders set status='contacted'$$,'42501',null,'direct reminder mutation denied');
select lives_ok($$select resolve_client_reminder('c0700000-0000-4000-8000-000000000001','contacted')$$,'manual contact completes reminder');
select lives_ok($$select resolve_client_reminder('c0700000-0000-4000-8000-000000000001','contacted')$$,'completion retry is safe');
select throws_ok($$select resolve_client_reminder('c0700000-0000-4000-8000-000000000001','cancelled')$$,'22023','Reminder already resolved','conflicting completion cannot overwrite history');
select is((select count(*) from client_reminders where status='pending'),0::bigint,'completed reminder leaves due list');
select ok((select resolved_at is not null from client_reminders),'contact time retained');
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from client_reminders),0::bigint,'other tenant cannot read reminders');
select throws_ok($$select pg_temp.remind()$$,'42501','Access denied','other tenant cannot replay reminder');
select throws_ok($$select client_product_history('c0800000-0000-4000-8000-000000000001')$$,'42501','Access denied','other tenant cannot read product history');
select throws_ok($$select client_product_history_filtered('c0800000-0000-4000-8000-000000000001',0,'%')$$,'42501','Access denied','filters do not bypass tenant restriction');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
update organization_memberships set role='advisor' where user_id='c0100000-0000-4000-8000-000000000001';
insert into membership_branch_assignments(organization_id,membership_id,branch_id)
select organization_id,id,'c0300000-0000-4000-8000-000000000003' from organization_memberships where user_id='c0100000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from client_reminders),0::bigint,'branch restriction hides reminders');
select throws_ok($$select pg_temp.remind()$$,'42501','Access denied','restricted branch cannot create or replay');
select throws_ok($$select resolve_client_reminder('c0700000-0000-4000-8000-000000000001','contacted')$$,'42501','Access denied','restricted branch cannot complete');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
update organization_memberships set role='viewer' where user_id='c0100000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.remind('Read only','c0300000-0000-4000-8000-000000000003')$$,'42501','Access denied','viewer cannot create reminders');
reset role;
select * from finish();
rollback;
