begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

-- Reproduce the drifted deployment, without changing the canonical validator.
create function public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer)
returns boolean language sql stable as $$select false$$;
select throws_ok($$select public.public_booking_slot_is_available(null::uuid,null::uuid,now(),30)$$,
  '42725',null,'obsolete overload reproduces the reported availability failure');

\ir ../migrations/0079_public_availability_function_resolution.sql
select is(to_regprocedure('public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer)'),null::regprocedure,'obsolete overload removed');
select is(public.public_booking_slot_is_available(null::uuid,null::uuid,now(),30),false,'four-argument callers resolve through the canonical default');
select is(public.public_booking_slot_is_available(null::uuid,null::uuid,now(),30,true),false,'explicit grid-validation callers still work');
select ok(not has_function_privilege('anon','public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer,boolean)','execute'),'private helper not callable anonymously');
select ok(not has_function_privilege('authenticated','public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer,boolean)','execute'),'private helper not callable directly by staff');

insert into organizations(id,name,slug,industry,public_page_enabled) values
('20790000-0000-4000-8000-000000000001','Availability Auto','availability-auto-test','automotive',true),
('20790000-0000-4000-8000-000000000002','Availability Salon','availability-salon-test','salon',true),
('20790000-0000-4000-8000-000000000003','Availability Pet','availability-pet-test','pet_care',true);
insert into branches(id,organization_id,name,timezone,is_primary,opening_hours,accepts_public_bookings)
select id,id,'Main','UTC',true,'{}',true from organizations where slug like 'availability-%-test';
insert into services(id,organization_id,name,duration_minutes,base_price_centavos,is_public,is_active)
select id,id,'Test service',30,10000,true,true from organizations where slug like 'availability-%-test';
create temporary table availability_cases as select id,slug from organizations where slug like 'availability-%-test';
grant select on availability_cases to anon;
set local role anon;
select lives_ok(format('select * from public.get_public_availability_dates_for_services(%L,%L::uuid,array[%L::uuid],current_date+1,current_date+10)',slug,id,id),slug||' multi-service calendar loads') from availability_cases;
select lives_ok(format('select * from public.get_public_availability_for_services(%L,%L::uuid,array[%L::uuid],current_date+1)',slug,id,id),slug||' daily slots load') from availability_cases;
select lives_ok(format('select * from public.get_public_availability(%L,%L::uuid,%L::uuid,current_date+1)',slug,id,id),slug||' legacy single-service slots load') from availability_cases;
select ok((select count(*)>0 from public.get_public_availability_dates_for_services('availability-salon-test','20790000-0000-4000-8000-000000000002',array['20790000-0000-4000-8000-000000000002']::uuid[],current_date+1,current_date+10)),'salon calendar returns bookable dates');
select is((select count(*) from public.get_public_availability_for_services('availability-salon-test','20790000-0000-4000-8000-000000000001',array['20790000-0000-4000-8000-000000000002']::uuid[],current_date+1)),0::bigint,'cross-tenant branch returns no slots');
reset role;
\ir ../migrations/0079_public_availability_function_resolution.sql
select lives_ok($$select public.public_booking_slot_is_available(null::uuid,null::uuid,now(),30)$$,'migration is safe to retry');
select * from finish();
rollback;
