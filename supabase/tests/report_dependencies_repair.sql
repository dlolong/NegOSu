begin;create extension if not exists pgtap with schema extensions;set search_path=public,extensions;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('1b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','report-owner-a@example.com','',now(),'{}','{}',now(),now()),
('1b000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','report-owner-b@example.com','',now(),'{}','{}',now(),now()),
('1b000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','report-viewer@example.com','',now(),'{}','{}',now(),now()),
('1b000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','report-cashier@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug)values('2b000000-0000-4000-8000-000000000001','Report A','report-a'),('2b000000-0000-4000-8000-000000000002','Report B','report-b');
insert into organization_subscriptions(organization_id,plan_id,status) values('2b000000-0000-4000-8000-000000000001','starter','active');
insert into organization_memberships(organization_id,user_id,role)values
('2b000000-0000-4000-8000-000000000001','1b000000-0000-4000-8000-000000000001','owner'),('2b000000-0000-4000-8000-000000000002','1b000000-0000-4000-8000-000000000002','owner'),('2b000000-0000-4000-8000-000000000001','1b000000-0000-4000-8000-000000000003','viewer'),('2b000000-0000-4000-8000-000000000001','1b000000-0000-4000-8000-000000000004','cashier');
insert into branches(id,organization_id,name,timezone,is_primary)values('4b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','Manila','Asia/Manila',true),('4b000000-0000-4000-8000-000000000002','2b000000-0000-4000-8000-000000000001','UTC','UTC',false),('4b000000-0000-4000-8000-000000000003','2b000000-0000-4000-8000-000000000002','Other','Asia/Manila',true);
insert into customers(id,organization_id,full_name)values('5b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','Repeat'),('5b000000-0000-4000-8000-000000000002','2b000000-0000-4000-8000-000000000002','Other');
insert into vehicles(id,organization_id,customer_id,make,model)values('6b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000001','Toyota','Vios'),('6b000000-0000-4000-8000-000000000002','2b000000-0000-4000-8000-000000000002','5b000000-0000-4000-8000-000000000002','Honda','City');
insert into service_categories(id,organization_id,name)values('7b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','Wash');insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos)values('8b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','Premium Wash',60,15000);
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,status,primary_technician_user_id,completed_at,created_at)values
('9b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','completed','1b000000-0000-4000-8000-000000000003','2026-01-01 16:30+00','2026-01-01 10:00+00'),
('9b000000-0000-4000-8000-000000000002','2b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','completed','1b000000-0000-4000-8000-000000000003','2025-12-01 10:00+00','2025-12-01 09:00+00');
insert into job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos)values('2b000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000001','8b000000-0000-4000-8000-000000000001','Premium Wash',2,15000,30000);
insert into invoices(id,organization_id,branch_id,job_order_id,invoice_number,status,customer_name_snapshot,vehicle_snapshot,subtotal_centavos,discount_centavos,tax_centavos,total_centavos,paid_centavos,balance_centavos,issued_at)values('ab000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000001','INV-1','partially_paid','Repeat','Toyota Vios',25000,1000,6000,30000,12000,18000,'2026-01-01 16:30+00');
insert into invoice_items(invoice_id,organization_id,service_id,category_name_snapshot,description_snapshot,quantity,unit_price_centavos,line_total_centavos)values('ab000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','8b000000-0000-4000-8000-000000000001','Wash','Premium Wash',1,15000,15000),('ab000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001',null,'Other','Other Service',1,10000,10000);select allocate_invoice_revenue('ab000000-0000-4000-8000-000000000001');
insert into payments(organization_id,branch_id,job_order_id,invoice_id,amount_centavos,status,method,paid_at)values('2b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001',12000,'paid','cash','2026-01-01 16:30+00');

-- Deliberately remove only the missing reporting prerequisites. This entire
-- fixture is transactional and must never be run against a hosted database.
drop function public.get_org_entitlements(uuid);
drop function public.has_entitlement(uuid,text);
drop function public.effective_entitlements(uuid);
drop function public.allocate_invoice_revenue(uuid);
alter table public.organization_subscriptions drop column grace_ends_at;
alter table public.invoice_items drop column job_order_item_id,drop column service_id,drop column category_name_snapshot,drop column recognized_revenue_centavos;
\ir ../migrations/0082_restore_report_dependencies.sql
select no_plan();
select has_function('public','get_org_entitlements',array['uuid'],'restores missing entitlement API');
select has_column('public','organization_subscriptions','grace_ends_at','restores grace-period state');
select has_column('public','invoice_items','recognized_revenue_centavos','restores revenue allocation');
select is((select sum(recognized_revenue_centavos) from invoice_items where invoice_id='ab000000-0000-4000-8000-000000000001')::bigint,30000::bigint,'historical allocation reconciles with invoice total');
select is((select total_centavos from invoices where id='ab000000-0000-4000-8000-000000000001'),30000::bigint,'invoice total unchanged');
select is((select balance_centavos from invoices where id='ab000000-0000-4000-8000-000000000001'),18000::bigint,'invoice balance unchanged');
select is((select amount_centavos from payments where invoice_id='ab000000-0000-4000-8000-000000000001'),12000::bigint,'payment unchanged');
insert into job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos)values('2b000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000002','8b000000-0000-4000-8000-000000000001','Premium Wash',1,15000,15000);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"1b000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(get_org_entitlements('2b000000-0000-4000-8000-000000000001')->>'planId','starter','Starter effective plan can be read');
select ok((get_org_entitlements('2b000000-0000-4000-8000-000000000001')->'features'->>'advanced_reports')::boolean,'Starter advanced reports retained');
select is((get_invoice_revenue_breakdown('2b000000-0000-4000-8000-000000000001','2026-01-02','2026-01-02')->'categories'->0->>'revenueCentavos')::bigint,30000::bigint,'repaired revenue includes historical lines without guessing a category');
select lives_ok($$select issue_invoice('9b000000-0000-4000-8000-000000000002')$$,'invoice issuing works after repair');
select is((select sum(item.recognized_revenue_centavos) from invoice_items item join invoices i on i.id=item.invoice_id where i.job_order_id='9b000000-0000-4000-8000-000000000002')::bigint,15000::bigint,'new invoices allocate revenue for future reports');
select throws_ok($$select get_org_entitlements('2b000000-0000-4000-8000-000000000002')$$,'42501','Organization not found','cross-tenant entitlement access denied');
select throws_ok($$select allocate_invoice_revenue('ab000000-0000-4000-8000-000000000001')$$,'42501',null,'clients cannot invoke private revenue writes');
set local role anon;
select throws_ok($$select get_org_entitlements('2b000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous entitlement access denied');
reset role;
\ir ../migrations/0082_restore_report_dependencies.sql
select is((select sum(recognized_revenue_centavos) from invoice_items where invoice_id='ab000000-0000-4000-8000-000000000001')::bigint,30000::bigint,'repeated repair preserves allocations');
select * from finish();
rollback;
