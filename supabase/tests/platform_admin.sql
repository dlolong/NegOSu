begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.platform_admin_overview(boolean)','execute'),'anonymous cannot read platform totals');
select ok(not has_function_privilege('authenticated','public.platform_admin_overview(boolean)','execute'),'tenant users cannot read platform totals');
select ok(not has_function_privilege('authenticated','public.platform_admin_signups(integer,text)','execute'),'tenant owners cannot read cross-tenant signups');
select ok(not has_function_privilege('anon','public.platform_admin_signups(integer,text)','execute'),'anonymous cannot read signups');
select ok(has_function_privilege('service_role','public.platform_admin_overview(boolean)','execute'),'trusted server can read overview');
select ok(has_function_privilege('service_role','public.platform_admin_signups(integer,text)','execute'),'trusted server can read signup directory');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('98100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-report-user@test.local','','{}','{}',now(),now());
insert into organizations(id,name,slug) values('98000000-0000-4000-8000-000000000001','Platform report test','platform-report-test');
insert into billing_orders(organization_id,created_by,request_id,plan_id,plan_name,billing_interval,amount_centavos,livemode,kind,status,paid_at) values
('98000000-0000-4000-8000-000000000001','98100000-0000-4000-8000-000000000001',gen_random_uuid(),'starter','Starter','month',12345,true,'new','paid',now()),
('98000000-0000-4000-8000-000000000001','98100000-0000-4000-8000-000000000001',gen_random_uuid(),'starter','Starter','month',67890,false,'new','paid',now()),
('98000000-0000-4000-8000-000000000001','98100000-0000-4000-8000-000000000001',gen_random_uuid(),'starter','Starter','month',99999,true,'new','review',now());
set local role authenticated;
set local "request.jwt.claims"='{"sub":"98100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok('select platform_admin_overview(true)','42501',null,'direct RPC call denied');
select throws_ok($$select platform_admin_signups(1,'')$$,'42501',null,'direct signup RPC denied');
reset role;
set local role service_role;
select is(jsonb_array_length(platform_admin_overview(true)->'signups'),30,'signup chart has 30 UTC days');
select is(jsonb_array_length(platform_admin_overview(true)->'payments'),30,'payment chart has 30 UTC days');
select is((platform_admin_overview(true)->>'collected')::bigint,(select coalesce(sum(amount_centavos),0)::bigint from billing_orders where livemode and status='paid' and paid_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') and paid_at<(((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC')),'live totals exclude test and review orders');
select is((platform_admin_overview(false)->>'collected')::bigint,(select coalesce(sum(amount_centavos),0)::bigint from billing_orders where not livemode and status='paid' and paid_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') and paid_at<(((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC')),'test totals exclude live orders');
select is((platform_admin_signups(1,'platform-report-user@test.local')->>'total')::integer,1,'signup without membership is searchable');
select is(jsonb_array_length(platform_admin_signups(2,'platform-report-user@test.local')->'rows'),0,'pagination does not repeat users');
select ok(not ((platform_admin_signups(1,'platform-report-user@test.local')->'rows'->0) ? 'encrypted_password'),'auth secrets never returned');
select is((platform_admin_signups(1,'%')->>'total')::integer,0,'search treats wildcard as literal text');
select throws_ok($$select platform_admin_signups(0,'')$$,'22023','Invalid directory filter','invalid page rejected');
select * from finish();
rollback;
