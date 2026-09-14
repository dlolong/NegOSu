-- Reservation-only customer queue: credential, scope, lifecycle, and privacy tests.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into organizations(id,name,slug,industry,public_page_enabled) values
('20650000-0000-4000-8000-000000000001','Queue Salon','queue-salon-test','salon',true),
('20650000-0000-4000-8000-000000000002','Other Salon','queue-other-test','salon',true),
('20650000-0000-4000-8000-000000000003','Private Salon','queue-private-test','salon',false),
('20650000-0000-4000-8000-000000000004','Auto','queue-auto-test','automotive',true);
update organizations set logo_url='https://example.test/queue-logo.png' where id='20650000-0000-4000-8000-000000000001';
insert into organization_subscriptions(organization_id,plan_id,status) values('20650000-0000-4000-8000-000000000001','business','active');
insert into branches(id,organization_id,name,timezone) values
('40650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','Main','Asia/Manila'),
('40650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','Other Branch','Asia/Manila'),
('40650000-0000-4000-8000-000000000003','20650000-0000-4000-8000-000000000002','Another Salon','Asia/Manila'),
('40650000-0000-4000-8000-000000000004','20650000-0000-4000-8000-000000000003','Private','Asia/Manila'),
('40650000-0000-4000-8000-000000000005','20650000-0000-4000-8000-000000000004','Auto','Asia/Manila');
insert into customers(id,organization_id,full_name,phone,email,notes) values
('50650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','  Maria   Secretlastname  ','09171234567','private@example.test','Private medical note'),
('50650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','Jun Otherlastname',null,null,null);
insert into appointments(id,organization_id,branch_id,customer_id,status,starts_at) values
('70650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','checked_in',((now() at time zone 'Asia/Manila')::date+time '09:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000002','in_service',((now() at time zone 'Asia/Manila')::date+time '08:30') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000003','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','confirmed',((now() at time zone 'Asia/Manila')::date+time '12:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000004','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','checked_in',(((now() at time zone 'Asia/Manila')::date-1)+time '12:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000005','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000002','50650000-0000-4000-8000-000000000001','checked_in',((now() at time zone 'Asia/Manila')::date+time '11:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000006','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','completed',((now() at time zone 'Asia/Manila')::date+time '07:00') at time zone 'Asia/Manila');

insert into public_booking_requests(id,organization_id,branch_id,status,public_reference,confirmation_token_hash,customer_name,phone,phone_normalized,preferred_at,duplicate_hash,rate_key_hash,appointment_id)
select case when a.id='70650000-0000-4000-8000-000000000001' then '90690000-0000-4000-8000-000000000001'::uuid else '90690000-0000-4000-8000-000000000002'::uuid end,
  a.organization_id,a.branch_id,'confirmed','RQ-'||a.id,
  encode(extensions.digest(repeat(case when a.id='70650000-0000-4000-8000-000000000001' then 'a' else 'b' end,64),'sha256'),'hex'),
  'Reservation Guest','09170000000','09170000000',a.starts_at,a.id::text,'reservation-test',a.id
from appointments a where a.id in('70650000-0000-4000-8000-000000000001','70650000-0000-4000-8000-000000000005');

select ok(not has_function_privilege('anon','public.get_public_salon_queue(text,uuid)','EXECUTE'),'anonymous visitors cannot call the slug-and-branch RPC');
select ok(not has_function_privilege('authenticated','public.get_public_salon_queue(text,uuid)','EXECUTE'),'login alone does not restore public queue access');
set local role anon;
select throws_ok($$select get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001')$$,'42501',null,'direct public queue invocation is denied');
select is(get_reservation_queue(null),null,'missing credential denied');
select is(get_reservation_queue('queue-salon-test'),null,'public slug is not a credential');
select is(get_reservation_queue(repeat('0',64)),null,'unknown reservation token denied');
select is(get_reservation_queue(repeat('a',64))->>'branchName','Main','confirmed reservation grants only its own branch queue');
select is(get_reservation_queue(repeat('b',64))->>'branchName','Other Branch','second reservation resolves its own branch');
select is(jsonb_array_length(get_reservation_queue(repeat('a',64))->'waiting'),1,'reservation cannot see another branch waiting list');
select ok(get_reservation_queue(repeat('a',64))::text !~ 'Secretlastname|Otherlastname|09171234567|private@example|medical|70650000|50650000','reservation queue retains abbreviated names and omits private fields');
set local role authenticated;
select throws_ok($$select get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated caller cannot bypass reservation lookup');
select is(get_reservation_queue(repeat('0',64)),null,'staff session without reservation does not grant customer endpoint access');
reset role;

update public_booking_requests set status='requested' where id='90690000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'unconfirmed request is not a reservation');
reset role;
update public_booking_requests set status='cancelled' where id='90690000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'cancelled reservation immediately denies future polling');
reset role;
update public_booking_requests set status='confirmed' where id='90690000-0000-4000-8000-000000000001';

update appointments set starts_at=starts_at+interval '1 day' where id='70650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'future reservation cannot inspect todays queue');
reset role;
update appointments set starts_at=starts_at-interval '2 days' where id='70650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'past reservation cannot become a permanent queue credential');
reset role;
update appointments set starts_at=starts_at+interval '1 day' where id='70650000-0000-4000-8000-000000000001';
update public_booking_requests set appointment_id='70650000-0000-4000-8000-000000000005' where id='90690000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'mismatched reservation and appointment branches fail closed');
reset role;
update public_booking_requests set appointment_id='70650000-0000-4000-8000-000000000006' where id='90690000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'completed appointment cannot inspect current queue');
reset role;
update public_booking_requests set appointment_id='70650000-0000-4000-8000-000000000001' where id='90690000-0000-4000-8000-000000000001';
update branches set is_active=false where id='40650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'inactive branch denied');
reset role;
update branches set is_active=true where id='40650000-0000-4000-8000-000000000001';
update organizations set public_page_enabled=false where id='20650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_reservation_queue(repeat('a',64)),null,'unpublished business does not expose customer queue');
select throws_ok($$select * from appointments$$,'42501',null,'anonymous appointment table access remains denied');
select throws_ok($$select * from customers$$,'42501',null,'anonymous customer table access remains denied');
reset role;
select ok((select relrowsecurity from pg_class where oid='public.appointments'::regclass),'appointment RLS remains enabled');
select ok((select relrowsecurity from pg_class where oid='public.customers'::regclass),'customer RLS remains enabled');
select * from finish();
rollback;
