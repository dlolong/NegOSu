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
update appointments set starts_at=(((now() at time zone 'Asia/Manila')::date)::timestamp at time zone 'Asia/Manila')+interval '10 hours', ends_at=(((now() at time zone 'Asia/Manila')::date)::timestamp at time zone 'Asia/Manila')+interval '11 hours' where organization_id='75200000-0000-4000-8000-000000000001';
update payments set paid_at=(((now() at time zone 'Asia/Manila')::date)::timestamp at time zone 'Asia/Manila')+interval '10 hours' where organization_id='75200000-0000-4000-8000-000000000001';
update organization_subscriptions set plan_id='free' where organization_id in('75200000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000002');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'summary'->>'grossSalesCentavos')::bigint,10000::bigint,'Free has real recent summary totals');
select lives_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'get_owner_report: Free 30-day boundary allowed');
select is(get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'services','[]'::jsonb,'get_owner_report: Free excludes services detail');
select is(get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'categories','[]'::jsonb,'get_owner_report: Free excludes categories detail');
select is(get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'technicians','[]'::jsonb,'get_owner_report: Free excludes technicians detail');
select is(get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'branches','[]'::jsonb,'get_owner_report: Free excludes branches detail');
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-30,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501','Free reports require one branch and dates within the last 30 days','get_owner_report: rejects older history');
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date+1,'75400000-0000-4000-8000-000000000001')$$,'42501','Free reports require one branch and dates within the last 30 days','get_owner_report: rejects future dates');
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,null)$$,'42501','Free reports require one branch and dates within the last 30 days','get_owner_report: rejects all branches');
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000003')$$,'42501','Branch not found','get_owner_report: foreign branch denied');
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000002',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000003')$$,'42501','Reporting access required','get_owner_report: foreign tenant denied');
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'get_appointment_report: Free 30-day boundary allowed');
select is(get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'services','[]'::jsonb,'get_appointment_report: Free excludes services detail');
select is(get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'categories','[]'::jsonb,'get_appointment_report: Free excludes categories detail');
select is(get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'technicians','[]'::jsonb,'get_appointment_report: Free excludes technicians detail');
select is(get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-29,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')->'branches','[]'::jsonb,'get_appointment_report: Free excludes branches detail');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date-30,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501','Free reports require one branch and dates within the last 30 days','get_appointment_report: rejects older history');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date+1,'75400000-0000-4000-8000-000000000001')$$,'42501','Free reports require one branch and dates within the last 30 days','get_appointment_report: rejects future dates');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,null)$$,'42501','Free reports require one branch and dates within the last 30 days','get_appointment_report: rejects all branches');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000003')$$,'42501','Branch not found','get_appointment_report: foreign branch denied');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000002',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000003')$$,'42501','Reporting access required','get_appointment_report: foreign tenant denied');
select throws_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501','Advanced reports require an eligible plan','Free cannot bypass paid breakdown via RPC');
select throws_ok($$select authorize_report_scope('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501',null,'Internal guard cannot be called directly');
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'Free viewer can read assigned branch');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000002')$$,'42501','Branch not found','Free viewer cannot read another branch');
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501','Reporting access required','Free still requires report permission');
reset role; update organization_subscriptions set plan_id='starter',status='active' where organization_id='75200000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(has_entitlement('75200000-0000-4000-8000-000000000001','advanced_reports'),'starter: full reports included');
select lives_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'starter: get_owner_report historical and all branches allowed');
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'starter: get_appointment_report historical and all branches allowed');
select lives_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'starter: get_invoice_revenue_breakdown historical and all branches allowed');
reset role; update organization_subscriptions set plan_id='business',status='active' where organization_id='75200000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(has_entitlement('75200000-0000-4000-8000-000000000001','advanced_reports'),'business: full reports included');
select lives_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'business: get_owner_report historical and all branches allowed');
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'business: get_appointment_report historical and all branches allowed');
select lives_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'business: get_invoice_revenue_breakdown historical and all branches allowed');
reset role; update organization_subscriptions set plan_id='pro',status='active' where organization_id='75200000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(has_entitlement('75200000-0000-4000-8000-000000000001','advanced_reports'),'pro: full reports included');
select lives_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'pro: get_owner_report historical and all branches allowed');
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'pro: get_appointment_report historical and all branches allowed');
select lives_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'pro: get_invoice_revenue_breakdown historical and all branches allowed');
reset role; update organization_subscriptions set plan_id='multi_branch',status='active' where organization_id='75200000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"75100000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(has_entitlement('75200000-0000-4000-8000-000000000001','advanced_reports'),'multi_branch: full reports included');
select lives_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'multi_branch: get_owner_report historical and all branches allowed');
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'multi_branch: get_appointment_report historical and all branches allowed');
select lives_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'multi_branch: get_invoice_revenue_breakdown historical and all branches allowed');
reset role; update organization_subscriptions set status='cancelled' where organization_id='75200000-0000-4000-8000-000000000001'; set local role authenticated;
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'Cancelled paid plan retains basic reporting');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,null)$$,'42501','Free reports require one branch and dates within the last 30 days','Downgrade removes advanced scope');
reset role; update organization_subscriptions set status='past_due',grace_ends_at=now()+interval '1 day' where organization_id='75200000-0000-4000-8000-000000000001'; set local role authenticated;
select lives_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001','2026-01-01','2026-02-01',null)$$,'Paid grace period preserves advanced reports');
reset role; update organization_subscriptions set grace_ends_at=now()-interval '1 day' where organization_id='75200000-0000-4000-8000-000000000001'; set local role authenticated;
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,null)$$,'42501','Free reports require one branch and dates within the last 30 days','Expired grace returns to basic reports');
set local role anon;
select throws_ok($$select get_owner_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501',null,'Anonymous cannot call get_owner_report');
select throws_ok($$select get_appointment_report('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501',null,'Anonymous cannot call get_appointment_report');
select throws_ok($$select get_invoice_revenue_breakdown('75200000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'75400000-0000-4000-8000-000000000001')$$,'42501',null,'Anonymous cannot call get_invoice_revenue_breakdown');
select * from finish();
rollback;
