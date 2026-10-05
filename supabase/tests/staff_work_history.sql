begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10550000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-owner@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-other@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-login@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000005','00000000-0000-0000-8000-000000000000','authenticated','authenticated',null,'',now(),'{}','{}',now(),now());
insert into public.profiles(id,full_name) values
('10550000-0000-4000-8000-000000000001','Owner One'),
('10550000-0000-4000-8000-000000000002','Owner Two'),
('10550000-0000-4000-8000-000000000003','Login Staff')
on conflict(id) do update set full_name=excluded.full_name;
insert into public.organizations(id,name,slug,industry) values
('20550000-0000-4000-8000-000000000001','History A','history-a','salon'),
('20550000-0000-4000-8000-000000000002','History B','history-b','automotive');
insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values
('30550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','10550000-0000-4000-8000-000000000001','owner',true),
('30550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','10550000-0000-4000-8000-000000000002','owner',true);
insert into public.branches(id,organization_id,name,timezone,is_primary) values
('40550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','A One','Asia/Manila',true),
('40550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000001','A Two','Asia/Manila',false),
('40550000-0000-4000-8000-000000000003','20550000-0000-4000-8000-000000000002','B One','Asia/Manila',true);
update public.branches set opening_hours='{"monday":{"open":"00:00","close":"23:59"},"tuesday":{"open":"00:00","close":"23:59"},"wednesday":{"open":"00:00","close":"23:59"},"thursday":{"open":"00:00","close":"23:59"},"friday":{"open":"00:00","close":"23:59"},"saturday":{"open":"00:00","close":"23:59"},"sunday":{"open":"00:00","close":"23:59"}}'::jsonb
where id='40550000-0000-4000-8000-000000000001';
insert into public.customers(id,organization_id,full_name) values
('50550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','Salon Client'),
('50550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','Auto Customer');
insert into public.services(id,organization_id,name,duration_minutes,base_price_centavos) values
('60550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','Haircut',30,50000),
('60550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','Inspection',30,50000);
insert into public.vehicles(id,organization_id,customer_id,make,model) values
('70550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','50550000-0000-4000-8000-000000000002','Test','Car');
insert into public.organization_staff_profiles(id,organization_id,full_name,job_function,is_active) values
('80550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','Offline Technician','Technician',true);
insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id) values
('80550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003');
insert into public.job_orders(id,organization_id,branch_id,customer_id,vehicle_id,status) values
('90550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003','50550000-0000-4000-8000-000000000002','70550000-0000-4000-8000-000000000001','queued');
insert into public.job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes) values
('a0550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','90550000-0000-4000-8000-000000000001','60550000-0000-4000-8000-000000000002','Inspection',1,50000,50000,30);
insert into public.job_inspections(organization_id,job_order_id,exterior_notes,inspected_by) values
('20550000-0000-4000-8000-000000000002','90550000-0000-4000-8000-000000000001','Ready','10550000-0000-4000-8000-000000000002');
insert into public.estimates(id,organization_id,branch_id,job_order_id,version,status,subtotal_centavos,total_centavos,authorized_total_centavos,approved_at) values
('b0550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003','90550000-0000-4000-8000-000000000001',1,'approved',50000,50000,50000,now());


select no_plan();
insert into public.organization_staff_profiles(id,organization_id,full_name,is_active) values
('80550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000001','Stylist One',true),
('80550000-0000-4000-8000-000000000003','20550000-0000-4000-8000-000000000001','Stylist Two',true),
('80550000-0000-4000-8000-000000000004','20550000-0000-4000-8000-000000000002','Auto Helper',true);
insert into public.appointments(id,organization_id,branch_id,customer_id,status,starts_at) values
('90550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000001','40550000-0000-4000-8000-000000000001','50550000-0000-4000-8000-000000000001','requested',now()),
('90550000-0000-4000-8000-000000000003','20550000-0000-4000-8000-000000000001','40550000-0000-4000-8000-000000000001','50550000-0000-4000-8000-000000000001','requested',now()+interval '1 day'),
('90550000-0000-4000-8000-000000000004','20550000-0000-4000-8000-000000000001','40550000-0000-4000-8000-000000000002','50550000-0000-4000-8000-000000000001','requested',now()+interval '2 days');
insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values
('20550000-0000-4000-8000-000000000001','90550000-0000-4000-8000-000000000002','80550000-0000-4000-8000-000000000002'),
('20550000-0000-4000-8000-000000000001','90550000-0000-4000-8000-000000000002','80550000-0000-4000-8000-000000000003'),
('20550000-0000-4000-8000-000000000001','90550000-0000-4000-8000-000000000003','80550000-0000-4000-8000-000000000002'),
('20550000-0000-4000-8000-000000000001','90550000-0000-4000-8000-000000000004','80550000-0000-4000-8000-000000000002');
update public.appointments set status='completed' where id in('90550000-0000-4000-8000-000000000002','90550000-0000-4000-8000-000000000004');
update public.organization_staff_profiles set is_active=false where id='80550000-0000-4000-8000-000000000003';
update public.job_orders set primary_technician_staff_id='80550000-0000-4000-8000-000000000001',status='completed',completed_at=now() where id='90550000-0000-4000-8000-000000000001';
update public.job_order_items set technician_staff_id='80550000-0000-4000-8000-000000000004',approval_status='approved' where id='a0550000-0000-4000-8000-000000000001';

select ok((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.staff_work_participation'::regclass),'participation retains invoker RLS');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.staff_completed_work'::regclass),'completed history retains invoker RLS');
set local role anon;
select throws_ok($$select * from public.staff_completed_work$$,'42501',null,'anonymous history access denied');
select throws_ok($$select * from public.staff_work_participation$$,'42501',null,'anonymous staff attribution denied');
reset role;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.staff_completed_work where record_id='90550000-0000-4000-8000-000000000002'),2::bigint,'both no-login staff appear for the completed visit');
select is((select count(*) from public.staff_completed_work where record_id='90550000-0000-4000-8000-000000000003'),0::bigint,'unfinished appointments do not appear as completed tasks');
select is((select count(*) from public.staff_completed_work where staff_id='80550000-0000-4000-8000-000000000003'),1::bigint,'inactive staff retain history');
select is((select count(*) from public.staff_work_participation where organization_id='20550000-0000-4000-8000-000000000002'),0::bigint,'foreign organization participation is hidden');
select is((select count(*) from public.staff_completed_work where organization_id='20550000-0000-4000-8000-000000000002'),0::bigint,'foreign organization history is hidden');
reset role;
insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values
('30550000-0000-4000-8000-000000000003','20550000-0000-4000-8000-000000000001','10550000-0000-4000-8000-000000000003','advisor',true);
insert into public.membership_branch_assignments(organization_id,membership_id,branch_id) values
('20550000-0000-4000-8000-000000000001','30550000-0000-4000-8000-000000000003','40550000-0000-4000-8000-000000000002');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public.staff_work_participation where branch_id='40550000-0000-4000-8000-000000000001'),0::bigint,'restricted branch cannot read contributor names');
select is((select count(*) from public.staff_completed_work where branch_id='40550000-0000-4000-8000-000000000001'),0::bigint,'restricted branch cannot read completed tasks');
select is((select count(*) from public.staff_completed_work where branch_id='40550000-0000-4000-8000-000000000002'),1::bigint,'allowed branch retains completed task');
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.staff_completed_work where record_id='90550000-0000-4000-8000-000000000001'),2::bigint,'job lead and service worker both retain job history');
select is((select source from public.staff_work_participation where staff_id='80550000-0000-4000-8000-000000000004'),'service_assignment','service-specific contributor remains identifiable');
select * from finish();
rollback;
