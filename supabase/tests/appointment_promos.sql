begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

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
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values
('c0400000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','Facial',60,100000);
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos) values
('c0500000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Cleanser','ml',100);


insert into customers(id,organization_id,full_name) values('c0800000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','Promo Client');
insert into commerce_promos(id,organization_id,branch_id,name,price_centavos,currency,status,components) values
('c0900000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Facial bundle',150000,'PHP','active',
 '[{"kind":"service","referenceId":"c0400000-0000-4000-8000-000000000001","quantity":"1","unit":"service"},{"kind":"product","referenceId":"c0500000-0000-4000-8000-000000000001","quantity":"12.500","unit":"ml"}]');
create function pg_temp.book(p_key uuid default 'c0700000-0000-4000-8000-000000000001',p_version integer default 1,p_date timestamptz default now()+interval '1 day') returns uuid language sql as $$
 select public.book_appointment_with_promos(p_key,'c0300000-0000-4000-8000-000000000001','c0800000-0000-4000-8000-000000000001',null,null,null,array['c0400000-0000-4000-8000-000000000001']::uuid[],jsonb_build_array(jsonb_build_object('id','c0900000-0000-4000-8000-000000000001','version',p_version)),p_date,'{}','{}',null,null,false);
$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select pg_temp.book()$$,'book active promo with its service');
select is(pg_temp.book(),pg_temp.book(),'exact retry returns original appointment');
select is((select count(*) from appointments)::bigint,1::bigint,'retry does not duplicate booking');
select is((select expected_total_centavos from appointments),150000::bigint,'appointment charges promo price once');
select is((select expected_duration_minutes from appointments),60,'appointment keeps included service duration');
select is((select components->1->>'quantity' from appointment_promo_snapshots),'12.500','fractional product quantity is snapshotted');
select is((select components->1->>'name' from appointment_promo_snapshots),'Cleanser','included product name is snapshotted');
select is((select count(*) from inventory_movements)::bigint,0::bigint,'booking does not post physical stock');
select throws_ok($$select pg_temp.book('c0700000-0000-4000-8000-000000000002',99)$$,'22023','Promo unavailable','stale displayed price is rejected');
select throws_ok($$select pg_temp.book('c0700000-0000-4000-8000-000000000001',99)$$,'22023','Request key reused with different details','changed retry is rejected');
select throws_ok($$update appointment_promo_snapshots set price_centavos=1$$,'42501',null,'accepted price cannot be edited directly');
select lives_ok($$update appointment_services set unit_price_centavos=1$$,'attempted price override is normalized');
select is((select expected_total_centavos from appointments),150000::bigint,'client cannot alter agreed promo total');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
update commerce_promos set price_centavos=200000,name='Renamed bundle',status='archived';
update inventory_items set name='Renamed cleanser' where id='c0500000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select price_centavos from appointment_promo_snapshots),150000::bigint,'catalog edits do not change accepted price');
select is((select components->1->>'name' from appointment_promo_snapshots),'Cleanser','product rename does not rewrite accepted inclusion');
select throws_ok($$select pg_temp.book('c0700000-0000-4000-8000-000000000003',2)$$,'22023','Promo unavailable','archived promo cannot be booked');
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from appointment_promo_snapshots)::bigint,0::bigint,'other tenant cannot read accepted offer');
select throws_ok($$select pg_temp.book()$$,'42501','Access denied','other tenant cannot book or replay receipt');
reset role;
select * from finish();
rollback;
