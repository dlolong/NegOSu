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
set local role anon;
select lives_ok($$select pg_temp.submit()$$,'public customer submits order');
select is(pg_temp.submit(),pg_temp.submit(),'exact public retries return same receipt');
select throws_ok($$select pg_temp.submit('refresh',3)$$,'P0409','A similar request is already pending','refresh with a new key and quantity does not duplicate pending order');
select throws_ok($$select pg_temp.submit('request',3)$$,'22023','Request key reused with different details','changed retry rejected');
select throws_ok($$select pg_temp.submit('bad-price',1,pg_temp.oid('product'),1)$$,'40001','Product price changed','browser cannot underprice product');
select throws_ok($$select pg_temp.submit('private',1,pg_temp.oid('private'))$$,'22023','Product unavailable','private product cannot be ordered');
select throws_ok($$select pg_temp.submit('other',1,pg_temp.oid('other-product'))$$,'22023','Product unavailable','cross-tenant product cannot be ordered');
select throws_ok($$select pg_temp.submit('zero',0)$$,'22023','Invalid order details','zero quantity rejected');
select throws_ok($$select * from public_product_orders$$,'42501',null,'anonymous cannot read customer orders');
select throws_ok($$select resolve_public_product_order(pg_temp.oid('request'),'confirm')$$,'42501',null,'anonymous cannot confirm orders');
reset role;
select is((select count(*) from public_product_orders),1::bigint,'duplicate submit stored once');
select is((select count(*) from checkouts),0::bigint,'public request creates no checkout');
select is(inventory_available_balance(pg_temp.oid('product')),5::numeric,'public request does not reserve stock');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('other'),'role','authenticated')::text,true);
select is((select count(*) from public_product_orders),0::bigint,'other tenant cannot read order contact details');
select throws_ok($$select resolve_public_product_order(pg_temp.oid('request'),'confirm')$$,'42501','Order unavailable','other tenant cannot confirm');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('cashier'),'role','authenticated')::text,true);
select is((select count(*) from public_product_orders),0::bigint,'restricted branch cannot read order');
select throws_ok($$select resolve_public_product_order(pg_temp.oid('request'),'confirm')$$,'42501','Order unavailable','restricted branch cannot confirm');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('viewer'),'role','authenticated')::text,true);
select throws_ok($$select resolve_public_product_order(pg_temp.oid('request'),'decline')$$,'42501','Order unavailable','viewer cannot decline');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('owner'),'role','authenticated')::text,true);
select throws_ok($$update public_product_orders set status='declined'$$,'42501',null,'direct status writes denied');
select lives_ok($$select resolve_public_product_order(pg_temp.oid('request'),'confirm')$$,'authorized staff confirms into checkout');
select is(resolve_public_product_order(pg_temp.oid('request'),'confirm'),resolve_public_product_order(pg_temp.oid('request'),'confirm'),'confirmation retry returns original checkout');
select is((select count(*) from checkouts),1::bigint,'confirmation creates one checkout');
select is((select count(*) from checkout_invoices),1::bigint,'confirmation posts one invoice');
select is((select total_centavos from invoices),25000::bigint,'invoice uses trusted price and quantity');
select is((select count(*) from payments),0::bigint,'confirmation does not record payment');
select is(inventory_available_balance(pg_temp.oid('product')),3::numeric,'confirmation reserves product quantity');
select is((select count(*) from public_product_orders where status='requested'),0::bigint,'resolved order leaves notification count');
select is((select count(*) from client_product_history((select customer_id from checkouts))),1::bigint,'confirmed purchase appears in client product history');
select is((select count(*) from client_product_history_filtered((select customer_id from checkouts),0,'retail')),1::bigint,'purchase filter matches product names case-insensitively');
select is((select count(*) from client_product_history_filtered((select customer_id from checkouts),0,'missing')),0::bigint,'purchase search excludes unrelated products');
select is((select count(*) from client_product_history_filtered((select customer_id from checkouts),0,'%')),0::bigint,'purchase search treats wildcard as literal text');
select is((select count(*) from client_product_history_filtered((select customer_id from checkouts),0,null,now()+interval '1 day',null)),0::bigint,'purchase date filter excludes older records');
select is((select count(*) from client_product_history_filtered((select customer_id from checkouts),1,'retail')),0::bigint,'purchase offset applies after filtering');

select throws_ok($$select resolve_public_product_order(pg_temp.oid('request'),'decline')$$,'22023','Order already resolved','confirmation cannot be overwritten');
select lives_ok($$select pg_temp.submit('too-much',10)$$,'public order is explicitly subject to stock confirmation');
select throws_ok($$select resolve_public_product_order(pg_temp.oid('too-much'),'confirm')$$,'P0001','Insufficient available stock','insufficient stock blocks confirmation');
select is((select status from public_product_orders where id=pg_temp.oid('too-much')),'requested','failed confirmation retains pending request');
select is((select count(*) from checkouts),1::bigint,'failed confirmation rolls back checkout');
select lives_ok($$select resolve_public_product_order(pg_temp.oid('too-much'),'decline')$$,'staff can decline unavailable order');
select lives_ok($$select resolve_public_product_order(pg_temp.oid('too-much'),'decline')$$,'decline retry is safe');
select lives_ok($$select pg_temp.submit('rate3')$$,'third request allowed');
select lives_ok($$select pg_temp.submit('rate4',2,pg_temp.oid('product'),12500,'09171234568')$$,'fourth request from a different customer allowed');
select lives_ok($$select pg_temp.submit('rate5',2,pg_temp.oid('product'),12500,'09171234569')$$,'fifth request from a different customer allowed');
select throws_ok($$select pg_temp.submit('rate6')$$,'54000','Too many order requests','public order rate cap enforced');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
update inventory_items set sell_price_centavos=13000 where id=pg_temp.oid('product');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.oid('owner'),'role','authenticated')::text,true);
select throws_ok($$select resolve_public_product_order(pg_temp.oid('rate3'),'confirm')$$,'22023','Product or price changed; contact the customer before taking a new order','confirmation cannot silently change customer price');
select is((select count(*) from checkouts),1::bigint,'stale-price confirmation creates no checkout');
reset role;
set local "request.jwt.claims"='{"role":"service_role"}';
update organizations set public_page_enabled=false where id=pg_temp.oid('org');
set local role anon;
select throws_ok($$select pg_temp.submit('disabled')$$,'22023','Product unavailable','disabled storefront rejects public orders');
reset role;
select * from finish();
rollback;
