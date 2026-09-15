begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('12000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ops-a@example.com','',now(),'{}','{}',now(),now()),
('12000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ops-b@example.com','',now(),'{}','{}',now(),now()),
('12000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ops-staff@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('22000000-0000-4000-8000-000000000001','Ops A','ops-a'),('22000000-0000-4000-8000-000000000002','Ops B','ops-b');
insert into organization_memberships(organization_id,user_id,role) values
('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','owner'),('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000003','advisor'),('22000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,timezone,is_primary) values('42000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Ops Branch A','Asia/Manila',true),('42000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','Ops Branch B','Asia/Manila',true);
insert into customers(id,organization_id,full_name) values('52000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Ops Customer A'),('52000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','Ops Customer B');
insert into vehicles(id,organization_id,customer_id,make,model,vehicle_type) values('62000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','Toyota','Fortuner','SUV'),('62000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','Honda','City','Sedan');
insert into service_categories(id,organization_id,name) values('72000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Wash'),('72000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','Wash');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values('82000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Basic Wash A',45,30000),('82000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','Basic Wash B',60,40000),('82000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Interior A',90,100000);
insert into service_prices(organization_id,service_id,branch_id,vehicle_class,price_centavos) values
('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',null,'suv',35000),('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',null,32500),('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','suv',37500);

update organizations set industry='salon' where id='22000000-0000-4000-8000-000000000002';
select plan(4);
-- Fire deferred row validators during each assertion, not after a rollback.
set constraints all immediate;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment(null,'42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001',array['82000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day')$$,'Automotive parent row validates using id');
select lives_ok($$update appointments set customer_note='updated' where organization_id='22000000-0000-4000-8000-000000000001'$$,'Automotive parent updates do not read missing appointment_id');
select lives_ok($$select create_walk_in('42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001',array['82000000-0000-4000-8000-000000000001'::uuid])$$,'Walk-in creation and enqueue validate the parent row');
set local "request.jwt.claims"='{"sub":"12000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select save_appointment(null,'42000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002',null,array['82000000-0000-4000-8000-000000000002'::uuid],now()+interval '1 day')$$,'Salon parent without vehicle validates using id');
select * from finish();
rollback;
