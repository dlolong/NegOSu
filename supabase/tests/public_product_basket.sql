begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.oid(text) returns uuid language sql immutable as $$select md5('public-product-order-test-'||$1)::uuid$$;
set local "request.jwt.claims"='{"role":"service_role"}';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select pg_temp.oid(v),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v||'@public-order.example.test','',now(),'{}','{}',now(),now() from unnest(array['owner','other','cashier','viewer'])v;
insert into organizations(id,name,slug,industry,public_page_enabled) values
(pg_temp.oid('org'),'Public Orders','public-order-test','salon',true),(pg_temp.oid('other-org'),'Other','public-order-other','salon',true);
insert into branches(id,organization_id,name,is_primary) values
(pg_temp.oid('branch'),pg_temp.oid('org'),'Main',true),(pg_temp.oid('restricted'),pg_temp.oid('org'),'Restricted',false),(pg_temp.oid('other-branch'),pg_temp.oid('other-org'),'Other',true);
insert into organization_memberships(id,organization_id,user_id,role) values
(pg_temp.oid('owner-member'),pg_temp.oid('org'),pg_temp.oid('owner'),'owner'),
(pg_temp.oid('other-member'),pg_temp.oid('other-org'),pg_temp.oid('other'),'owner'),
(pg_temp.oid('cashier-member'),pg_temp.oid('org'),pg_temp.oid('cashier'),'cashier'),
(pg_temp.oid('viewer-member'),pg_temp.oid('org'),pg_temp.oid('viewer'),'viewer');
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values(pg_temp.oid('org'),pg_temp.oid('cashier-member'),pg_temp.oid('restricted'));
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos,product_purpose,is_public)
values(pg_temp.oid('product'),pg_temp.oid('org'),pg_temp.oid('branch'),'Retail bottle','bottle',12500,'retail',true),
(pg_temp.oid('private'),pg_temp.oid('org'),pg_temp.oid('branch'),'Private bottle','bottle',12500,'retail',false),
(pg_temp.oid('other-product'),pg_temp.oid('other-org'),pg_temp.oid('other-branch'),'Other bottle','bottle',12500,'retail',true);
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,note)
values(pg_temp.oid('org'),pg_temp.oid('branch'),pg_temp.oid('product'),'opening',5,'Test stock');
create function pg_temp.submit(p_key text default 'request',p_qty numeric default 2,p_product uuid default pg_temp.oid('product'),p_price bigint default 12500,p_phone text default '09171234567') returns jsonb language sql as $$
 select submit_public_product_order('public-order-test',p_product,p_qty,pg_temp.oid(p_key),'Test Client',p_phone,'client@example.test','Pickup',repeat('a',64),p_price,'PHP','bottle','');
$$;

insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos,product_purpose,is_public)
values(pg_temp.oid('second'),pg_temp.oid('org'),pg_temp.oid('branch'),'Second bottle','bottle',5000,'retail',true),
(pg_temp.oid('wrong-branch'),pg_temp.oid('org'),pg_temp.oid('restricted'),'Other branch bottle','bottle',5000,'retail',true);
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,note)
values(pg_temp.oid('org'),pg_temp.oid('branch'),pg_temp.oid('second'),'opening',5,'Test stock');
create function pg_temp.basket(second_id uuid default pg_temp.oid('second')) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('productId',pg_temp.oid('product'),'quantity','2','expectedPrice',12500,'expectedCurrency','PHP','expectedUnit','bottle'),jsonb_build_object('productId',second_id,'quantity','1','expectedPrice',5000,'expectedCurrency','PHP','expectedUnit','bottle'));
$$;
create function pg_temp.submit_basket(k text default 'basket',items jsonb default pg_temp.basket()) returns jsonb language sql as $$
 select public.submit_public_product_basket('public-order-test',items,pg_temp.oid(k),'Test Client','09171234567','','Pickup',repeat('a',64),'');
$$;
set local role anon;
select throws_ok($$select pg_temp.submit_basket('cross',pg_temp.basket(pg_temp.oid('wrong-branch')))$$,'22023','Choose one pickup branch','cross-branch basket rejected');
select throws_ok($$select pg_temp.submit_basket('private',pg_temp.basket(pg_temp.oid('private')))$$,'22023','Product unavailable','private product rejected atomically');
select lives_ok($$select pg_temp.submit_basket()$$,'multiple products submitted together');
select is(pg_temp.submit_basket(),pg_temp.submit_basket(),'retry returns the same reference');
select throws_ok($$select pg_temp.submit_basket('basket',jsonb_set(pg_temp.basket(),'{0,quantity}','"3"'))$$,'22023','Retry content changed','changed basket retry rejected');
select throws_ok($$select * from public_product_order_lines$$,'42501',null,'anonymous cannot read order lines');
select throws_ok($$select pg_temp.submit('overlap',1,pg_temp.oid('second'),5000)$$,'P0409','A similar request is already pending','legacy endpoint cannot duplicate a secondary basket product');
reset role;
select is((select count(*) from public_product_orders),1::bigint,'one parent order');
select is((select count(*) from public_product_order_lines),2::bigint,'all lines saved');
select is((select count(*) from checkouts),0::bigint,'no checkout before staff confirmation');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('other'),'role','authenticated')::text,true);
select is((select count(*) from public_product_order_lines),0::bigint,'cross-tenant lines hidden');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('cashier'),'role','authenticated')::text,true);
select is((select count(*) from public_product_order_lines),0::bigint,'restricted branch lines hidden');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('owner'),'role','authenticated')::text,true);
select lives_ok($$select resolve_public_product_order(pg_temp.oid('basket'),'confirm')$$,'staff confirms complete basket');
select is((select count(*) from checkouts),1::bigint,'one checkout for basket');
select is((select count(*) from checkout_lines),2::bigint,'both checkout products');
select is((select total_centavos from invoices),30000::bigint,'trusted total includes both products');
select is(resolve_public_product_order(pg_temp.oid('basket'),'confirm'),resolve_public_product_order(pg_temp.oid('basket'),'confirm'),'confirmation retry is safe');
select * from finish();
rollback;
