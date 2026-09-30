begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10640000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-salon-owner@example.test','',now(),'{}','{"full_name":"Public Salon Owner"}',now(),now()),
('10640000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-other-owner@example.test','',now(),'{}','{"full_name":"Other Owner"}',now(),now()),
('10640000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-salon-advisor@example.test','',now(),'{}','{"full_name":"Restricted Advisor"}',now(),now());
insert into organizations(id,name,slug,industry,public_page_enabled) values
('20640000-0000-4000-8000-000000000001','Public Salon','public-salon-sql-test','salon',true),
('20640000-0000-4000-8000-000000000002','Public Automotive','public-auto-sql-test','automotive',true),
('20640000-0000-4000-8000-000000000003','Private Salon','private-salon-sql-test','salon',false);
update organizations set logo_url='https://example.test/salon-logo.png' where id='20640000-0000-4000-8000-000000000001';
insert into organization_memberships(id,organization_id,user_id,role) values
('30640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','10640000-0000-4000-8000-000000000001','owner'),
('30640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000002','10640000-0000-4000-8000-000000000002','owner'),
('30640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','10640000-0000-4000-8000-000000000003','advisor');
insert into branches(id,organization_id,name,timezone,is_primary,opening_hours) values
('40640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','Salon Main','Pacific/Honolulu',true,'{}'),
('40640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000001','Salon Other','Pacific/Honolulu',false,'{}'),
('40640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000002','Auto Main','Pacific/Honolulu',true,'{}');
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values
('20640000-0000-4000-8000-000000000001','30640000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000002');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos,is_public,is_active) values
('60640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','Haircut',30,10000,true,true),
('60640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000001','Color',60,25000,true,true),
('60640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','Other Branch Treatment',15,5000,true,true),
('60640000-0000-4000-8000-000000000004','20640000-0000-4000-8000-000000000001','Private Treatment',15,5000,false,true),
('60640000-0000-4000-8000-000000000005','20640000-0000-4000-8000-000000000001','Inactive Treatment',15,5000,true,false),
('60640000-0000-4000-8000-000000000006','20640000-0000-4000-8000-000000000002','Vehicle Wash',30,7000,true,true);
insert into service_branch_availability(organization_id,service_id,branch_id,is_available) values
('20640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000002',true);
insert into service_prices(organization_id,service_id,branch_id,vehicle_class,price_centavos) values
('20640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001',null,12000);


insert into inventory_items(id,organization_id,branch_id,name,unit,product_purpose) values
('c1060000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001','Take-home shampoo','bottle','retail'),
('c1060000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001','PRIVATE internal concentrate','ml','internal');
insert into commerce_promos(id,organization_id,branch_id,name,description,price_centavos,currency,status,is_public,image_url,valid_from,valid_through,components) values
('c1060000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001','Haircut bundle','Haircut and take-home shampoo',15000,'PHP','active',true,'https://example.test/promo.jpg',current_date,current_date+10,
 '[{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000001","quantity":"1","unit":"service"},{"kind":"product","referenceId":"c1060000-0000-4000-8000-000000000001","quantity":"1","unit":"bottle"},{"kind":"supply","referenceId":"c1060000-0000-4000-8000-000000000002","quantity":"12.500","unit":"ml"}]');
insert into commerce_promos(id,organization_id,branch_id,name,price_centavos,currency,status,is_public,components)
 select 'c1060000-0000-4000-8000-000000000004',organization_id,branch_id,'PRIVATE hidden offer',price_centavos,currency,'active',false,components from commerce_promos where id='c1060000-0000-4000-8000-000000000003';
create function pg_temp.booking_time() returns timestamptz language sql stable as $$select (((now() at time zone 'Pacific/Honolulu')::date+2)+time '10:00') at time zone 'Pacific/Honolulu'$$;
create function pg_temp.promo_request(p_version integer default 1,p_id uuid default 'c1060000-0000-4000-8000-000000000003',p_branch uuid default '40640000-0000-4000-8000-000000000001',p_at timestamptz default pg_temp.booking_time(),p_phone text default '09175550106') returns jsonb language sql as $$
 select public.submit_public_promo_booking('public-salon-sql-test',p_branch,array['60640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000002']::uuid[],jsonb_build_array(jsonb_build_object('id',p_id,'version',p_version)),p_at,'Promo Client',p_phone,null,null,null,null,null,null,null,null,null,'Public promo note','public-promo-test-'||p_phone,'');
$$;
create function pg_temp.save_promo_image(p_url text default 'https://example.test/updated.jpg',p_key uuid default 'c1060000-0000-4000-8000-000000000007') returns uuid language sql as $$
 select save_commerce_promo_details('20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001','c1060000-0000-4000-8000-000000000003',2,'Changed catalog name','Haircut and take-home shampoo',99999,'archived',current_date,current_date+10,(select components from commerce_promos where id='c1060000-0000-4000-8000-000000000003'),p_key,p_url,true);
$$;
create temporary table result(response jsonb);
grant all on result to anon,authenticated;
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(jsonb_array_length(get_public_promos('public-salon-sql-test')),1,'only the published active promo is public');
select is(get_public_promos('private-salon-sql-test'),'[]'::jsonb,'private business exposes no promos');
select is(get_public_promos('public-salon-sql-test')->0->>'imageUrl','https://example.test/promo.jpg','public image URL is projected');
select is(jsonb_array_length(get_public_promos('public-salon-sql-test')->0->'inclusions'),1,'only retail inclusions are public');
select ok(position('PRIVATE' in get_public_promos('public-salon-sql-test')::text)=0,'internal supply names and hidden promos never leak');
select throws_ok($$select * from commerce_promos$$,'42501',null,'anon cannot query raw promos');
select throws_ok($$select * from public_booking_promo_snapshots$$,'42501',null,'anon cannot query requested offer table');
select throws_ok($$select resolve_commerce_promo_offer(null,null,null,null,current_date,true)$$,'42501',null,'private offer validator cannot be invoked by anon');
select throws_ok($$select pg_temp.promo_request(99)$$,'22023','Promo unavailable','stale displayed version is rejected');
select throws_ok($$select pg_temp.promo_request(1,'c1060000-0000-4000-8000-000000000004')$$,'22023','Promo unavailable','unpublished promo cannot be requested');
select throws_ok($$select pg_temp.promo_request(1,'c1060000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000002')$$,'22023','Promo unavailable','other branch cannot use this offer');
select throws_ok($$select pg_temp.promo_request(1,'c1060000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000001',pg_temp.booking_time()+interval '20 days')$$,'22023','Promo unavailable','expired promo cannot be requested');
insert into result select pg_temp.promo_request();
select is((select (get_public_booking_status(response->>'token')->>'requestedTotalCentavos')::bigint from result),40000::bigint,'promo replaces normal service price and adds the other service once');
select is((select get_public_booking_status(response->>'token')->'promos'->0->>'name' from result),'Haircut bundle','customer token shows requested promo');
select ok((select position('PRIVATE' in get_public_booking_status(response->>'token')::text)=0 from result),'token status hides internal supplies');
select throws_ok($$select pg_temp.promo_request()$$,'P0001','A similar booking request is already pending','duplicate public request is rejected');
select is(get_public_booking_status(repeat('0',64)),null::jsonb,'invalid token reveals nothing');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is((select count(*) from public_booking_promo_snapshots)::bigint,1::bigint,'one immutable requested offer');
select is((select components->2->>'quantity' from public_booking_promo_snapshots),'12.500','internal native quantity is preserved privately');
update commerce_promos set price_centavos=99999,name='Changed catalog name',status='archived' where id='c1060000-0000-4000-8000-000000000003';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public_booking_promo_snapshots)::bigint,0::bigint,'restricted branch advisor cannot read requested offer');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public_booking_promo_snapshots)::bigint,0::bigint,'other tenant cannot read requested offer');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$update public_booking_promo_snapshots set price_centavos=1$$,'42501',null,'staff cannot overwrite requested promo price');
select lives_ok($$select review_public_booking((select id from public_booking_requests where rate_key_hash='public-promo-test-09175550106'),'confirm')$$,'owner confirms request after catalog change');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='public-promo-test-09175550106')),40000::bigint,'confirmation preserves original price and other service charge');
select is((select name from appointment_promo_snapshots),'Haircut bundle','confirmation preserves original promo name');
select is((select count(*) from inventory_movements where inventory_item_id in('c1060000-0000-4000-8000-000000000001','c1060000-0000-4000-8000-000000000002'))::bigint,0::bigint,'request and confirmation do not post physical stock');
select lives_ok($$select pg_temp.save_promo_image()$$,'owner can save promo image URL');
select is((select image_url from commerce_promos where id='c1060000-0000-4000-8000-000000000003'),'https://example.test/updated.jpg','image URL is stored');
select is(pg_temp.save_promo_image(),pg_temp.save_promo_image(),'image save retry is idempotent');
select throws_ok($$select pg_temp.save_promo_image('https://example.test/other.jpg')$$,'22023','Request key reused with different details','image is part of the retry payload');
reset role;
set local "request.jwt.claims"='{}';
select throws_ok($$update commerce_promos set image_url='javascript:alert(1)' where id='c1060000-0000-4000-8000-000000000003'$$,'23514',null,'database rejects executable image schemes');
select throws_ok($$update commerce_promos set image_url='https://user:password@example.test/a.jpg' where id='c1060000-0000-4000-8000-000000000003'$$,'23514',null,'database rejects image credentials');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('7c100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pet-a@example.test','',now(),'{}','{}',now(),now()),
('7c100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pet-b@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,industry,business_type) values
('7c200000-0000-4000-8000-000000000001','Milo Grooming Test','pet-a-test','pet_care','pet_grooming'),
('7c200000-0000-4000-8000-000000000002','Other Grooming Test','pet-b-test','pet_care','pet_grooming');
insert into organization_subscriptions(organization_id,plan_id,status) select id,'pro','active' from organizations where id in('7c200000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000002');
insert into organization_memberships(organization_id,user_id,role) values('7c200000-0000-4000-8000-000000000001','7c100000-0000-4000-8000-000000000001','owner'),('7c200000-0000-4000-8000-000000000002','7c100000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,is_primary) values('7c300000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','Main',true),('7c300000-0000-4000-8000-000000000002','7c200000-0000-4000-8000-000000000002','Other',true);
update branches set opening_hours=(select jsonb_object_agg(d,jsonb_build_object('open','00:00','close','23:59')) from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])d) where id in('7c300000-0000-4000-8000-000000000001','7c300000-0000-4000-8000-000000000002');
insert into customers(id,organization_id,full_name) values('7c400000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','Maria Test'),('7c400000-0000-4000-8000-000000000002','7c200000-0000-4000-8000-000000000002','Other Test');
insert into pet_profiles(id,organization_id,customer_id,name,species,handling_cautions) values('7c500000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','7c400000-0000-4000-8000-000000000001','Milo','dog','INTERNAL_DO_NOT_EXPOSE'),('7c500000-0000-4000-8000-000000000002','7c200000-0000-4000-8000-000000000001','7c400000-0000-4000-8000-000000000001','Luna','cat',null),('7c500000-0000-4000-8000-000000000003','7c200000-0000-4000-8000-000000000002','7c400000-0000-4000-8000-000000000002','Other Pet','dog',null);
insert into organization_staff_profiles(id,organization_id,full_name,job_function) values('7c600000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','Ana Test','Groomer'),('7c600000-0000-4000-8000-000000000002','7c200000-0000-4000-8000-000000000001','Bo Test','Groomer');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values('7c700000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','Bath and brush',60,50000);
insert into scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity) values('7c800000-0000-4000-8000-000000000001','7c200000-0000-4000-8000-000000000001','7c300000-0000-4000-8000-000000000001','Grooming Room','room',2);

update organizations set public_page_enabled=true where id='7c200000-0000-4000-8000-000000000001';
update services set is_public=true where id='7c700000-0000-4000-8000-000000000001';
insert into inventory_items(id,organization_id,branch_id,name,unit,product_purpose) values('c1060000-0000-4000-8000-000000000005','7c200000-0000-4000-8000-000000000001','7c300000-0000-4000-8000-000000000001','Pet shampoo','bottle','retail');
insert into commerce_promos(id,organization_id,branch_id,name,price_centavos,currency,status,is_public,components) values('c1060000-0000-4000-8000-000000000006','7c200000-0000-4000-8000-000000000001','7c300000-0000-4000-8000-000000000001','Grooming bundle',60000,'PHP','active',true,
 '[{"kind":"service","referenceId":"7c700000-0000-4000-8000-000000000001","quantity":"1","unit":"service"},{"kind":"product","referenceId":"c1060000-0000-4000-8000-000000000005","quantity":"1","unit":"bottle"}]');
create temporary table pet_promo_result(response jsonb);
grant all on pet_promo_result to anon,authenticated;
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
insert into pet_promo_result select submit_public_promo_booking('pet-a-test','7c300000-0000-4000-8000-000000000001',array['7c700000-0000-4000-8000-000000000001']::uuid[],'[{"id":"c1060000-0000-4000-8000-000000000006","version":1}]',date_trunc('day',now())+interval '5 days 2 hours','Pet Promo Owner','09175550107',null,null,null,null,null,null,'Milo','dog',null,null,'public-pet-promo-test','');
select is((select get_public_booking_status(response->>'token')->'promos'->0->>'name' from pet_promo_result),'Grooming bundle','pet request retains promo and subject');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"7c100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select confirm_pet_public_booking((select id from public_booking_requests where rate_key_hash='public-pet-promo-test'),null,'7c600000-0000-4000-8000-000000000001','7c800000-0000-4000-8000-000000000001')$$,'pet confirmation attaches promo through its existing adapter');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='public-pet-promo-test')),60000::bigint,'pet appointment charges requested fixed price');
select is((select count(*) from appointment_promo_snapshots)::bigint,1::bigint,'pet tenant only reads its own accepted offer');
select lives_ok($$select confirm_pet_public_booking((select id from public_booking_requests where rate_key_hash='public-pet-promo-test'),null,null,null)$$,'pet confirmation retry does not duplicate accepted offer');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;

insert into inventory_items(id,organization_id,branch_id,name,unit,product_purpose) values('c1060000-0000-4000-8000-000000000008','20640000-0000-4000-8000-000000000002','40640000-0000-4000-8000-000000000003','Car care bottle','bottle','retail');
insert into commerce_promos(id,organization_id,branch_id,name,price_centavos,currency,status,is_public,components) values('c1060000-0000-4000-8000-000000000009','20640000-0000-4000-8000-000000000002','40640000-0000-4000-8000-000000000003','Wash bundle',17000,'PHP','active',true,
 '[{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000006","quantity":"1","unit":"service"},{"kind":"product","referenceId":"c1060000-0000-4000-8000-000000000008","quantity":"1","unit":"bottle"}]');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select lives_ok($$select submit_public_promo_booking('public-auto-sql-test','40640000-0000-4000-8000-000000000003',array['60640000-0000-4000-8000-000000000006']::uuid[],'[{"id":"c1060000-0000-4000-8000-000000000009","version":1}]',pg_temp.booking_time(),'Auto Promo Client','09175550108',null,'Toyota','Vios',2020,'sedan','PROMO-106',null,null,null,null,'public-auto-promo-test','')$$,'automotive public promo keeps vehicle intake');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select review_public_booking((select id from public_booking_requests where rate_key_hash='public-auto-promo-test'),'confirm')$$,'automotive promo request confirms through canonical review');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='public-auto-promo-test')),17000::bigint,'automotive appointment keeps promo price');
select ok((select vehicle_id is not null from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='public-auto-promo-test')),'automotive vehicle remains attached');
reset role;
set local "request.jwt.claims"='{}';
update commerce_promos set status='active',is_public=false where id='c1060000-0000-4000-8000-000000000003';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select book_appointment_with_promos('c1060000-0000-4000-8000-000000000010','40640000-0000-4000-8000-000000000001',(select customer_id from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='public-promo-test-09175550106')),null,null,null,array['60640000-0000-4000-8000-000000000001']::uuid[],jsonb_build_array(jsonb_build_object('id','c1060000-0000-4000-8000-000000000003','version',(select version from commerce_promos where id='c1060000-0000-4000-8000-000000000003'))),pg_temp.booking_time()+interval '1 day','{}','{}',null,null,false)$$,'staff promo booking still works through shared validator for unpublished offers');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;
select * from finish();
rollback;
