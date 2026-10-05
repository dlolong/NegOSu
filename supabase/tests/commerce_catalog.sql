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

create function pg_temp.save_promo(p_quantity text default '12.500',p_unit text default 'ml',p_key uuid default 'c0600000-0000-4000-8000-000000000001') returns uuid language sql as $$
 select public.save_commerce_promo('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',null,null,'Facial and cleanser','',150000,'draft',null,null,
 jsonb_build_array(jsonb_build_object('kind','service','referenceId','c0400000-0000-4000-8000-000000000001','quantity','1','unit','service'),jsonb_build_object('kind','product','referenceId','c0500000-0000-4000-8000-000000000001','quantity',p_quantity,'unit',p_unit)),p_key);
$$;

create function pg_temp.save_product() returns uuid language sql as $$
 select public.save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',null,'New retail product','CATALOG-TEST','','','piece',1250,'retail',true,true,'c0700000-0000-4000-8000-000000000002');
$$;

set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select pg_temp.save_promo()$$,'owner creates a promo with exact fractional units');
select lives_ok($$select pg_temp.save_product()$$,'owner can add a brand-new product through the current save API');
select is(pg_temp.save_product(),pg_temp.save_product(),'product creation retry returns the original product');
select is((select count(*) from inventory_items where sku='CATALOG-TEST')::bigint,1::bigint,'product retry does not duplicate the catalog item');
select is((select sell_price_centavos from inventory_items where sku='CATALOG-TEST'),1250::bigint,'product price is preserved in exact minor units');
select is((select count(*) from commerce_promos)::bigint,1::bigint,'one definition exists');
select is((select count(*) from inventory_movements where inventory_item_id='c0500000-0000-4000-8000-000000000001')::bigint,0::bigint,'promo creation does not move stock');
select is(pg_temp.save_promo(),pg_temp.save_promo(),'exact retry returns the original definition');
select throws_ok($$select pg_temp.save_promo('13')$$,'22023','Request key reused with different details','changed retry rejected');
select throws_ok($$select pg_temp.save_promo('1','bottle','c0600000-0000-4000-8000-000000000002')$$,'22023','Product unavailable or unsupported unit conversion','implicit bottle conversion rejected');
select throws_ok($$select pg_temp.save_promo('0.0001','ml','c0600000-0000-4000-8000-000000000003')$$,'22023','Invalid promo component','excess quantity precision rejected');
select throws_ok($$update commerce_promos set price_centavos=1$$,'42501',null,'direct financial definition edits denied');
select throws_ok($$delete from commerce_promos$$,'42501',null,'definitions cannot be deleted directly');
select throws_ok($$select * from commerce_catalog_requests$$,'42501',null,'private retry receipts cannot be read directly');
select lives_ok($$update inventory_items set stock_tracked=false where id='c0500000-0000-4000-8000-000000000001'$$,'unused product can become non-stock');
select throws_ok($$select record_inventory_movement('c0500000-0000-4000-8000-000000000001','opening',1,null,'catalog-nonstock-test')$$,'22023','Non-stock products cannot have physical stock movements','non-stock product cannot receive an opening balance');
select lives_ok($$update inventory_items set stock_tracked=true where id='c0500000-0000-4000-8000-000000000001'$$,'unused product can restore stock tracking');
select lives_ok($$select record_inventory_movement('c0500000-0000-4000-8000-000000000001','opening',1,null,'catalog-opening-test')$$,'tracked products keep the existing ledger operation');
select throws_ok($$update inventory_items set unit='bottle' where id='c0500000-0000-4000-8000-000000000001'$$,'22023','Stock history exists; unit and stock identity cannot change','historical units cannot silently change');

-- Flexible definitions still enforce unique catalog identities.
create function pg_temp.flexible_promo(parts jsonb) returns uuid language sql as $$
 select public.save_commerce_promo('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',null,null,'Flexible promo','',100,'draft',null,null,parts,gen_random_uuid());
$$;
select lives_ok($$select pg_temp.flexible_promo('[{"kind":"product","referenceId":"c0500000-0000-4000-8000-000000000001","quantity":"2","unit":"ml"}]')$$,'product-only promo accepted');
select lives_ok($$select pg_temp.flexible_promo('[{"kind":"supply","referenceId":"c0500000-0000-4000-8000-000000000001","quantity":"2","unit":"ml"}]')$$,'supply-only promo accepted');
select lives_ok($$select pg_temp.flexible_promo('[{"kind":"service","referenceId":"c0400000-0000-4000-8000-000000000001","quantity":"1","unit":"service"}]')$$,'service-only promo accepted');
select throws_ok($$select pg_temp.flexible_promo('[]')$$,'22023','A promo needs between 1 and 30 components','empty promo rejected');
select throws_ok($$select pg_temp.flexible_promo('[{"kind":"product","referenceId":"c0500000-0000-4000-8000-000000000001","quantity":"1","unit":"ml"},{"kind":"supply","referenceId":"C0500000-0000-4000-8000-000000000001","quantity":"1","unit":"ml"}]')$$,'22023','Duplicate promo component','same inventory item cannot be repeated under another kind or UUID casing');

set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from commerce_promos)::bigint,0::bigint,'other tenant cannot read definitions');
select throws_ok($$select pg_temp.save_promo()$$,'42501','Promo management access required','other tenant cannot invoke writes');
select throws_ok($$select save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',null,'Bad product','','','','piece',100,'retail',true,true,'c0700000-0000-4000-8000-000000000001')$$,'42501','Product management access required','cross-tenant product creation denied');
reset role;
select * from finish();
rollback;
