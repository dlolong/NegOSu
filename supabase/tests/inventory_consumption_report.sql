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


update branches set timezone='Asia/Manila' where id='c0300000-0000-4000-8000-000000000001';
insert into inventory_items(id,organization_id,branch_id,name,unit) values
('c0500000-0000-4000-8000-000000000002','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','No activity','piece');
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,created_at,created_by,idempotency_key) values
('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','c0500000-0000-4000-8000-000000000001','opening',10,'2026-10-04T15:59:00Z','c0100000-0000-4000-8000-000000000001','report-opening'),
('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','c0500000-0000-4000-8000-000000000001','usage',-2.5,'2026-10-04T16:00:00Z','c0100000-0000-4000-8000-000000000001','report-usage'),
('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','c0500000-0000-4000-8000-000000000001','waste',-1,'2026-10-05T16:00:00Z','c0100000-0000-4000-8000-000000000001','report-next-day');
update inventory_items set category='Skin care' where id='c0500000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
create function pg_temp.inventory_report() returns jsonb language sql as $$
 select public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-05',1);
$$;
select is((public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-05',1,'','Skin care')->>'count')::integer,1,'category filters before pagination');
select is((public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-05',1,'','Uncategorized')->'totals'->0->>'consumed')::numeric,0::numeric,'category totals exclude other products');
select is((pg_temp.inventory_report()->>'count')::integer,2,'all products including zero-activity included');
select is((pg_temp.inventory_report()->'rows'->0->>'opening')::numeric,10::numeric,'opening uses branch-local midnight');
select is((pg_temp.inventory_report()->'rows'->0->>'consumed')::numeric,2.5::numeric,'consumption at local midnight included');
select is((pg_temp.inventory_report()->'rows'->0->>'closing')::numeric,7.5::numeric,'next day excluded from closing');
select throws_ok($$select public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000002','2026-10-05','2026-10-05',1)$$,'42501','Branch access required','foreign branch rejected');
select is((public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-05',1,'cleanser')->>'count')::integer,1,'search filters products before pagination');
select is((public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-05',1,'no match')->>'count')::integer,0,'unmatched search returns no products');
select is((pg_temp.inventory_report()->'product_daily'->0->>'inventory_item_id'),'c0500000-0000-4000-8000-000000000001','daily product cells identify their product');
select is((pg_temp.inventory_report()->'product_daily'->0->>'consumed')::numeric,2.5::numeric,'daily product consumption preserves exact quantities');
select is((pg_temp.inventory_report()->'daily'->0->>'consumed')::numeric,2.5::numeric,'daily consumption respects branch-local dates');
select is((pg_temp.inventory_report()->'daily'->1->>'consumed')::numeric,0::numeric,'daily consumption includes units with zero activity');
select is(jsonb_array_length(public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-01','2026-10-31',1)->'daily'),62,'month includes every day for each of two units');
select is(jsonb_array_length(pg_temp.inventory_report()->'totals'),2,'different units have separate totals');
select throws_ok($$select public.get_inventory_consumption_report('c0200000-0000-4000-8000-000000000001',null,'2026-10-05','2026-10-04',1)$$,'22023','Invalid report range','reversed range rejected');
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.inventory_report()$$,'42501','Report access required','other tenant cannot read report');
reset role;
select * from finish();
rollback;
