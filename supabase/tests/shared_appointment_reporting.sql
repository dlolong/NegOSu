begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('75100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','core-report-'||n||'@local.test','',now(),'{}','{}',now(),now() from generate_series(1,4)n;
insert into organizations(id,name,slug,industry) values('75200000-0000-4000-8000-000000000001','Report salon','core-report-salon','salon'),('75200000-0000-4000-8000-000000000002','Report pet','core-report-pet','pet_care');
insert into organization_subscriptions(organization_id,plan_id,status) select id,'pro','active' from organizations where id in('75200000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000002');
insert into organization_memberships(id,organization_id,user_id,role) values
('75300000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','owner'),
('75300000-0000-4000-8000-000000000002','75200000-0000-4000-8000-000000000002','75100000-0000-4000-8000-000000000002','owner'),
('75300000-0000-4000-8000-000000000003','75200000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000003','viewer'),
('75300000-0000-4000-8000-000000000004','75200000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000004','cashier');
insert into branches(id,organization_id,name,timezone,is_primary) values
('75400000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','Manila','Asia/Manila',true),
('75400000-0000-4000-8000-000000000002','75200000-0000-4000-8000-000000000001','UTC','UTC',false),
('75400000-0000-4000-8000-000000000003','75200000-0000-4000-8000-000000000002','Other','UTC',true);
insert into membership_branch_assignments values('75300000-0000-4000-8000-000000000003','75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001',now());
insert into customers(id,organization_id,full_name) values('75500000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','Repeat client');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values('75600000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','Snapshot service',30,10000);
insert into appointments(id,organization_id,branch_id,customer_id,status,starts_at,ends_at) values
('75700000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001','75500000-0000-4000-8000-000000000001','completed','2026-01-01 16:30Z','2026-01-01 17:00Z'),
('75700000-0000-4000-8000-000000000002','75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000002','75500000-0000-4000-8000-000000000001','confirmed','2026-01-02 16:30Z','2026-01-02 17:00Z'),
('75700000-0000-4000-8000-000000000003','75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001','75500000-0000-4000-8000-000000000001','cancelled','2026-01-02 18:30Z','2026-01-02 19:00Z');
insert into appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) select id,'75600000-0000-4000-8000-000000000001','Snapshot service',10000,30 from appointments where organization_id='75200000-0000-4000-8000-000000000001';
insert into payments(organization_id,branch_id,appointment_id,amount_centavos,method,status,paid_at) values
('75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001','75700000-0000-4000-8000-000000000001',4000,'cash','paid','2026-01-01 16:10Z'),
('75200000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001','75700000-0000-4000-8000-000000000001',500,'cash','voided','2026-01-01 16:10Z');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'grossSalesCentavos')::bigint,10000::bigint,'sales use completed snapshots');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'paymentsReceivedCentavos')::bigint,4000::bigint,'cash uses branch-local date and excludes reversed');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'outstandingCentavos')::bigint,16000::bigint,'all selected branch unpaid appointments count');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'services'->0->>'revenueCentavos')::bigint,10000::bigint,'service revenue matches snapshots');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'jobsCompleted')::integer,1,'legacy report contract counts completed appointments');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-01-01')->'summary'->>'paymentsReceivedCentavos')::bigint,0::bigint,'UTC previous day excluded');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000002','2026-01-02','2026-01-02')$$,'42501','Reporting access required','other tenant denied');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02','75400000-0000-4000-8000-000000000003')$$,'42501','Branch not found','foreign branch denied');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-01')$$,'22023','Invalid reporting range','invalid range denied');
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'outstandingCentavos')::bigint,6000::bigint,'report viewer restricted to assigned branch');
select is((get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'summary'->>'paymentsReceivedCentavos')::bigint,4000::bigint,'report viewer gets authorized aggregates without ledger access');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02','75400000-0000-4000-8000-000000000002')$$,'42501','Branch not found','unassigned branch denied');
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')$$,'42501','Reporting access required','cashier cannot read reports');
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((get_appointment_report('75200000-0000-4000-8000-000000000002','2026-01-02','2026-01-02')->'summary'->>'grossSalesCentavos')::bigint,0::bigint,'empty Pet business has valid report');
reset role;
update organization_subscriptions set plan_id='free' where organization_id='75200000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000002','2026-01-02','2026-01-02')$$,'42501','Reporting access required','plan entitlement enforced in database');
set local role anon;
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')$$,'42501',null,'anonymous reporting denied');
select * from finish();
rollback;
