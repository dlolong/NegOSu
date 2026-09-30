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


insert into organization_staff_profiles(id,organization_id,full_name,job_function) values
('c1080000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','Suggested Stylist','Stylist'),
('c1080000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000002','Other Tenant Staff','Technician');
create function pg_temp.booking_time() returns timestamptz language sql stable as $$select (((now() at time zone 'Pacific/Honolulu')::date+2)+time '10:00') at time zone 'Pacific/Honolulu'$$;
create temporary table result(response jsonb);
grant all on result to anon,authenticated;
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
insert into result select submit_public_booking('public-salon-sql-test','40640000-0000-4000-8000-000000000001',array['60640000-0000-4000-8000-000000000001']::uuid[],pg_temp.booking_time(),'Alternative Client','09175550108',null,null,null,null,null,null,'Prefer Suggested Stylist','alternative-test','');
select throws_ok($$select * from public_booking_alternatives$$,'42501',null,'raw offers remain private');
select throws_ok($$select propose_booking_alternative(null,0,now(),null,null,'')$$,'42501',null,'anonymous users cannot propose');
select throws_ok($$select validate_booking_alternative(null,now(),null,null)$$,'42501',null,'private validation helper is not callable');
reset role;
create temporary table request as select id from public_booking_requests where rate_key_hash='alternative-test';
grant select on request to authenticated;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '1 day',null,null,'Try tomorrow')$$,'42501',null,'cross-tenant proposal denied');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '1 day',null,null,'Try tomorrow')$$,'42501',null,'wrong branch proposal denied');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '1 day','c1080000-0000-4000-8000-000000000002',null,'Try tomorrow')$$,'22023','Staff unavailable','foreign staff denied');
select is(propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '1 day','c1080000-0000-4000-8000-000000000001',null,'Your stylist is available tomorrow'),1,'staff can propose another time and staff');
select is(propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '1 day','c1080000-0000-4000-8000-000000000001',null,'Your stylist is available tomorrow'),1,'proposal retry is idempotent');
select is((select preferred_at from public_booking_requests where id=(select id from request)),pg_temp.booking_time(),'proposal does not change client request');
select throws_ok($$select review_public_booking((select id from request),'confirm')$$,'22023','Wait for the customer response','legacy confirmation cannot bypass agreement');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is((select get_public_booking_status(response->>'token')->'alternative'->>'staffName' from result),'Suggested Stylist','private link shows suggested staff');
select throws_ok($$select respond_booking_alternative(repeat('0',64),1,'accept')$$,'42501','Booking unavailable','wrong token cannot respond');
select throws_ok($$select respond_booking_alternative((select response->>'token' from result),2,'accept')$$,'40001','Proposal changed; reload','wrong version cannot respond');
select is(respond_booking_alternative((select response->>'token' from result),1,'accept'),'accepted','client can accept');
select is(respond_booking_alternative((select response->>'token' from result),1,'accept'),'accepted','acceptance retry is idempotent');
select is((select get_public_booking_status(response->>'token')->>'status' from result),'requested','acceptance awaits business final confirmation');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select preferred_at from public_booking_requests where id=(select id from request)),pg_temp.booking_time()+interval '1 day','accepted time becomes preferred time');
select lives_ok($$select confirm_booking_alternative((select id from request),1,null)$$,'business confirms accepted alternative');
select is(confirm_booking_alternative((select id from request),1,null),confirm_booking_alternative((select id from request),1,null),'confirmation retry does not duplicate appointment');
select is((select count(*) from appointment_staff_assignments where appointment_id=(select appointment_id from public_booking_requests where id=(select id from request)) and staff_profile_id='c1080000-0000-4000-8000-000000000001'),1::bigint,'agreed staff is assigned');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select respond_booking_alternative((select response->>'token' from result),1,'cancel')$$,'22023',null,'alternative response cannot cancel a confirmed appointment');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;
-- Another request demonstrates supersession and cancellation without an appointment.
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
delete from result;
insert into result select submit_public_booking('public-salon-sql-test','40640000-0000-4000-8000-000000000001',array['60640000-0000-4000-8000-000000000001']::uuid[],pg_temp.booking_time()+interval '2 days','Cancel Client','09175550110',null,null,null,null,null,null,null,'alternative-cancel','');
reset role;
set local "request.jwt.claims"='{}';
update request set id=(select id from public_booking_requests where rate_key_hash='alternative-cancel');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '3 days',null,null,'First offer'),1,'first alternative created');
select is(propose_booking_alternative((select id from request),1,pg_temp.booking_time()+interval '4 days',null,null,'Revised offer'),2,'business can revise suggestion');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select respond_booking_alternative((select response->>'token' from result),1,'accept')$$,'40001','Proposal changed; reload','stale offer acceptance rejected');
select is(respond_booking_alternative((select response->>'token' from result),2,'cancel'),'cancelled','client can cancel pending request');
select is(respond_booking_alternative((select response->>'token' from result),2,'cancel'),'cancelled','cancellation retry is idempotent');
select is((select get_public_booking_status(response->>'token')->>'status' from result),'cancelled','cancelled state visible on private link');
reset role;
set local "request.jwt.claims"='{}';
select is((select appointment_id from public_booking_requests where rate_key_hash='alternative-cancel'),null::uuid,'cancelled request creates no appointment');
set constraints all immediate;

-- Multi-service promo terms survive a changed date and final confirmation.
set constraints all deferred;
insert into commerce_promos(id,organization_id,branch_id,name,price_centavos,currency,status,is_public,valid_through,components) values
('c1080000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001','Two service offer',29999,'PHP','active',true,current_date+20,
 '[{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000001","quantity":"1","unit":"service"},{"kind":"service","referenceId":"60640000-0000-4000-8000-000000000002","quantity":"1","unit":"service"}]');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
delete from result;
insert into result select submit_public_promo_booking('public-salon-sql-test','40640000-0000-4000-8000-000000000001',array['60640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000002']::uuid[],'[{"id":"c1080000-0000-4000-8000-000000000003","version":1}]',pg_temp.booking_time()+interval '5 days','Promo Alternative','09175550111',null,null,null,null,null,null,null,null,null,null,'alternative-promo','');
reset role;
set local "request.jwt.claims"='{}';
update request set id=(select id from public_booking_requests where rate_key_hash='alternative-promo');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '30 days',null,null,'Too late')$$,'22023','Promo unavailable on proposed date','promo expiration checked for alternative');
select is(propose_booking_alternative((select id from request),0,pg_temp.booking_time()+interval '6 days',null,null,'Same bundle another day'),1,'promo alternative can be proposed');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(respond_booking_alternative((select response->>'token' from result),1,'accept'),'accepted','client accepts promo alternative');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select confirm_booking_alternative((select id from request),1,null)$$,'promo alternative confirmed through existing snapshot trigger');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where id=(select id from request))),29999::bigint,'accepted promo keeps original fixed price');
select is((select count(*) from appointment_promo_snapshots where appointment_id=(select appointment_id from public_booking_requests where id=(select id from request))),2::bigint,'all bundled services remain attached');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;

set constraints all deferred;
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

set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
delete from result;
insert into result select submit_public_promo_booking('pet-a-test','7c300000-0000-4000-8000-000000000001',array['7c700000-0000-4000-8000-000000000001']::uuid[],'[{"id":"c1060000-0000-4000-8000-000000000006","version":1}]',date_trunc('day',now())+interval '5 days 2 hours','Pet Alternative','09175550112',null,null,null,null,null,null,'Milo','dog',null,null,'alternative-pet','');
reset role;
set local "request.jwt.claims"='{}';
update request set id=(select id from public_booking_requests where rate_key_hash='alternative-pet');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"7c100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select propose_booking_alternative((select id from request),0,date_trunc('day',now())+interval '6 days 2 hours',null,null,'Another time')$$,'22023','Choose a groomer and resource','pet alternative requires groomer and resource');
select is(propose_booking_alternative((select id from request),0,date_trunc('day',now())+interval '6 days 2 hours','7c600000-0000-4000-8000-000000000001','7c800000-0000-4000-8000-000000000001','Another time'),1,'pet alternative can be proposed');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(respond_booking_alternative((select response->>'token' from result),1,'accept'),'accepted','pet owner accepts alternative');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"7c100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select confirm_booking_alternative((select id from request),1,null)$$,'pet alternative uses canonical pet confirmation');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where id=(select id from request))),60000::bigint,'pet promo price preserved');
reset role;
set local "request.jwt.claims"='{}';
set constraints all immediate;
select * from finish();
rollback;
