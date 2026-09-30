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
create function pg_temp.bundle_parts() returns jsonb language sql as $$select '[{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000001","quantity":"1","unit":"service"},{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000002","quantity":"1","unit":"service"}]'::jsonb$$;
create function pg_temp.booking_time() returns timestamptz language sql stable as $$select (((now() at time zone 'Pacific/Honolulu')::date+2)+time '10:00') at time zone 'Pacific/Honolulu'$$;
create function pg_temp.create_bundle() returns uuid language sql as $$select save_commerce_promo_details('20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001',null,0,'Haircut and color','Two services',29999,'active',null,null,pg_temp.bundle_parts(),'c1070000-0000-4000-8000-000000000001',null,true)$$;
create temporary table bundle(id uuid);
create temporary table result(response jsonb);
grant all on bundle,result to anon,authenticated;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.create_bundle()$$,'42501',null,'other tenant cannot create a bundle');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select pg_temp.create_bundle()$$,'42501',null,'branch-restricted advisor cannot create a bundle');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into bundle select pg_temp.create_bundle();
select is(pg_temp.create_bundle(),(select id from bundle),'multiple-service save retry is idempotent');
reset role;
set local "request.jwt.claims"='{}';
select throws_ok($$update commerce_promos set components=pg_temp.bundle_parts()||jsonb_build_array(pg_temp.bundle_parts()->0) where id=(select id from bundle)$$,'22023','Duplicate promo component','duplicate services rejected');
select throws_ok($$update commerce_promos set components=jsonb_set(pg_temp.bundle_parts(),'{1,referenceId}','"60640000-0000-4000-8000-000000000006"') where id=(select id from bundle)$$,'22023','Service unavailable','foreign tenant service rejected');
select throws_ok($$update commerce_promos set components=jsonb_set(pg_temp.bundle_parts(),'{1,quantity}','"2"') where id=(select id from bundle)$$,'22023',null,'each scheduled service must have quantity one');
create function pg_temp.request_bundle(p_services uuid[] default array['60640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000002']::uuid[],p_promos jsonb default null) returns jsonb language sql as $$
 select submit_public_promo_booking('public-salon-sql-test','40640000-0000-4000-8000-000000000001',p_services,coalesce(p_promos,(select jsonb_build_array(jsonb_build_object('id',id,'version',1)) from bundle)),pg_temp.booking_time(),'Bundle Client','09175550109',null,null,null,null,null,null,null,null,null,null,'multi-bundle-test','');
$$;
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(jsonb_array_length(get_public_promos('public-salon-sql-test')),1,'public bundle appears once');
select is(jsonb_array_length(get_public_promos('public-salon-sql-test')->0->'serviceIds'),2,'public bundle lists both services');
select is((get_public_promos('public-salon-sql-test')->0->>'durationMinutes')::int,90,'public duration includes both services');
select throws_ok($$select pg_temp.request_bundle(array['60640000-0000-4000-8000-000000000001']::uuid[])$$,'22023','Select one offer per service','omitting a bundled service is rejected');
select throws_ok($$select pg_temp.request_bundle(p_promos:=(select jsonb_build_array(jsonb_build_object('id',id,'version',1),jsonb_build_object('id',id,'version',1)) from bundle))$$,'22023','Select one offer per service','overlapping duplicate selections rejected');
reset role;
set local "request.jwt.claims"='{}';
update services set is_public=false where id='60640000-0000-4000-8000-000000000002';
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_promos('public-salon-sql-test'),'[]'::jsonb,'private second service hides entire bundle');
select throws_ok($$select pg_temp.request_bundle()$$,'22023','Promo service unavailable','private second service blocks direct booking');
reset role;
set local "request.jwt.claims"='{}';
update services set is_public=true where id='60640000-0000-4000-8000-000000000002';
insert into service_branch_availability(organization_id,service_id,branch_id,is_available) values('20640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000002','40640000-0000-4000-8000-000000000002',true);
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_promos('public-salon-sql-test'),'[]'::jsonb,'unavailable second service branch hides bundle');
select throws_ok($$select pg_temp.request_bundle()$$,'22023','Promo service unavailable','second service branch availability enforced');
reset role;
set local "request.jwt.claims"='{}';
delete from service_branch_availability where service_id='60640000-0000-4000-8000-000000000002';
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
insert into result select pg_temp.request_bundle();
select is((select (get_public_booking_status(response->>'token')->>'requestedTotalCentavos')::bigint from result),29999::bigint,'public bundle charges fixed price once');
select is((select jsonb_array_length(get_public_booking_status(response->>'token')->'promos') from result),1,'status groups allocations into one promo');
select is((select (get_public_booking_status(response->>'token')->'promos'->0->>'priceCentavos')::bigint from result),29999::bigint,'status shows full bundle price');
select throws_ok($$select pg_temp.request_bundle()$$,'P0001','A similar booking request is already pending','duplicate intake remains rejected');
reset role;
set local "request.jwt.claims"='{}';
select is((select sum(duration_minutes)::int from public_booking_promo_snapshots),90,'both service durations saved');
select is((select array_agg(price_centavos order by service_id) from public_booking_promo_snapshots),array[15000,14999]::bigint[],'odd centavo allocation is deterministic and exact');
update commerce_promos set price_centavos=50000,status='archived' where id=(select id from bundle);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public_booking_promo_snapshots),0::bigint,'other branch cannot read bundle allocations');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select review_public_booking((select id from public_booking_requests where rate_key_hash='multi-bundle-test'),'confirm')$$,'confirm after catalog change preserves requested bundle');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='multi-bundle-test')),29999::bigint,'confirmed total is original bundle price');
select is((select sum(duration_minutes)::int from appointment_services where appointment_id=(select appointment_id from public_booking_requests where rate_key_hash='multi-bundle-test')),90,'confirmed services retain combined duration');
select is((select count(*) from appointment_promo_snapshots),2::bigint,'one protected allocation per bundled service');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;
select throws_ok($$delete from appointment_services where service_id='60640000-0000-4000-8000-000000000002'$$,'P0001','Booked promo services cannot be removed','all bundled services protected during edits');
update commerce_promos set price_centavos=1,status='active' where id=(select id from bundle);
create function pg_temp.staff_bundle() returns uuid language sql as $$
 select book_appointment_with_promos('c1070000-0000-4000-8000-000000000002','40640000-0000-4000-8000-000000000001',(select customer_id from appointments where id=(select appointment_id from public_booking_requests where rate_key_hash='multi-bundle-test')),null,null,null,array['60640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000002']::uuid[],(select jsonb_build_array(jsonb_build_object('id',p.id,'version',p.version)) from commerce_promos p join bundle b on b.id=p.id),pg_temp.booking_time()+interval '1 day','{}','{}',null,null,false);
$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select pg_temp.staff_bundle()$$,'staff can book multi-service bundle with price below service count');
select is(pg_temp.staff_bundle(),pg_temp.staff_bundle(),'staff booking retry returns same appointment');
select is((select expected_total_centavos from appointments where id=pg_temp.staff_bundle()),1::bigint,'staff fixed price including zero allocation remains exact');
select is((select sum(duration_minutes)::int from appointment_services where appointment_id=pg_temp.staff_bundle()),90,'staff duration includes both services');
select throws_ok($$update appointment_promo_snapshots set price_centavos=100$$,'42501',null,'staff cannot alter agreed allocations');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;
select * from finish();
rollback;
