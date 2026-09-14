-- Category removal keeps catalog records; all fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(17);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('19700000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','category-owner@example.test','',now(),'{}','{}',now(),now()),
('19700000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','category-advisor@example.test','',now(),'{}','{}',now(),now()),
('19700000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','category-manager@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values ('29700000-0000-4000-8000-000000000001','Category A','category-test-a'),('29700000-0000-4000-8000-000000000002','Category B','category-test-b');
insert into organization_memberships(organization_id,user_id,role) values
('29700000-0000-4000-8000-000000000001','19700000-0000-4000-8000-000000000001','owner'),
('29700000-0000-4000-8000-000000000001','19700000-0000-4000-8000-000000000002','advisor'),
('29700000-0000-4000-8000-000000000001','19700000-0000-4000-8000-000000000003','manager');
insert into service_categories(id,organization_id,name) values
('79700000-0000-4000-8000-000000000001','29700000-0000-4000-8000-000000000001','Used category'),
('79700000-0000-4000-8000-000000000002','29700000-0000-4000-8000-000000000002','Foreign category'),
('79700000-0000-4000-8000-000000000003','29700000-0000-4000-8000-000000000001','Empty category');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values
('89700000-0000-4000-8000-000000000001','29700000-0000-4000-8000-000000000001','79700000-0000-4000-8000-000000000001','Service A',30,10000),
('89700000-0000-4000-8000-000000000002','29700000-0000-4000-8000-000000000001','79700000-0000-4000-8000-000000000001','Service B',60,30000);
set local role anon;
select throws_ok($$delete from service_categories where id='79700000-0000-4000-8000-000000000001'$$,'42501',null,'anonymous category deletion denied');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"19700000-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty($$delete from service_categories where id='79700000-0000-4000-8000-000000000001' returning id$$,'advisor cannot delete categories');
select is_empty($$update service_categories set name='Blocked' where id='79700000-0000-4000-8000-000000000001' returning id$$,'advisor cannot edit categories');
select throws_ok($$insert into service_categories(organization_id,name) values('29700000-0000-4000-8000-000000000001','Blocked')$$,'42501',null,'advisor cannot create categories');
set local "request.jwt.claims"='{"sub":"19700000-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$delete from service_categories where id='79700000-0000-4000-8000-000000000002' returning id$$,'owner cannot delete another tenants category');
select is_empty($$update service_categories set name='Blocked' where id='79700000-0000-4000-8000-000000000002' returning id$$,'owner cannot edit another tenants category');
select lives_ok($$update service_categories set name='Updated category' where id='79700000-0000-4000-8000-000000000001'$$,'owner can rename category');
select is((select name from service_categories where id='79700000-0000-4000-8000-000000000001'),'Updated category','category rename persisted');
select lives_ok($$delete from service_categories where id='79700000-0000-4000-8000-000000000001'$$,'owner can delete used category');
select is_empty($$select id from service_categories where id='79700000-0000-4000-8000-000000000001'$$,'deleted category removed');
select is((select count(*) from services where organization_id='29700000-0000-4000-8000-000000000001'),2::bigint,'services preserved');
select is((select count(*) from services where organization_id='29700000-0000-4000-8000-000000000001' and category_id is null),2::bigint,'services become Uncategorized');
select is((select sum(base_price_centavos) from services where organization_id='29700000-0000-4000-8000-000000000001'),40000::numeric,'service prices preserved');
reset role;
select is((select count(*) from service_categories where id='79700000-0000-4000-8000-000000000002'),1::bigint,'foreign category preserved');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"19700000-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$delete from service_categories where id='79700000-0000-4000-8000-000000000001' returning id$$,'repeated deletion changes nothing');
set local "request.jwt.claims"='{"sub":"19700000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$delete from service_categories where id='79700000-0000-4000-8000-000000000003'$$,'manager can delete own category');
select is_empty($$delete from service_categories where id='79700000-0000-4000-8000-000000000002' returning id$$,'manager cannot delete another tenants category');
select * from finish();
rollback;
