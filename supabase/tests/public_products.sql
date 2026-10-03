begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('c0100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','commerce-owner@example.test','',now(),'{}','{}',now(),now()),
('c0100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','commerce-outsider@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,industry) values
('c0200000-0000-4000-8000-000000000001','Public Products','public-products-test','salon'),
('c0200000-0000-4000-8000-000000000002','Other Business','commerce-other-test','automotive');
insert into organization_memberships(organization_id,user_id,role) values
('c0200000-0000-4000-8000-000000000001','c0100000-0000-4000-8000-000000000001','owner'),
('c0200000-0000-4000-8000-000000000002','c0100000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,is_primary) values
('c0300000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','Main',true),
('c0300000-0000-4000-8000-000000000002','c0200000-0000-4000-8000-000000000002','Other',true);

update organizations set public_page_enabled=true where id='c0200000-0000-4000-8000-000000000001';
insert into branches(id,organization_id,name,is_active) values ('c0300000-0000-4000-8000-000000000003','c0200000-0000-4000-8000-000000000001','Inactive',false);
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos,is_public,is_active,product_purpose) values
('c0500000-0000-4000-8000-000000000001','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Visible','piece',1250,true,true,'retail'),
('c0500000-0000-4000-8000-000000000002','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Private','piece',1250,false,true,'retail'),
('c0500000-0000-4000-8000-000000000003','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Inactive item','piece',1250,true,false,'retail'),
('c0500000-0000-4000-8000-000000000004','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','Supply','piece',1250,true,true,'internal'),
('c0500000-0000-4000-8000-000000000005','c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000003','Inactive branch','piece',1250,true,true,'both'),
('c0500000-0000-4000-8000-000000000006','c0200000-0000-4000-8000-000000000002','c0300000-0000-4000-8000-000000000002','Other tenant','piece',1250,true,true,'retail');
create function pg_temp.publish_product(p_public boolean default true,p_key uuid default 'c0600000-0000-4000-8000-000000000001',p_id uuid default 'c0500000-0000-4000-8000-000000000002',p_purpose text default 'retail') returns uuid language sql as $$
 select save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',p_id,'Published product','','','','piece',1250,p_purpose,true,true,p_key,p_public)
$$;
create function pg_temp.product_photo(p_url text,p_key uuid default 'c0800000-0000-4000-8000-000000000001') returns uuid language sql as $$
 select save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','c0500000-0000-4000-8000-000000000001','Visible','','','','piece',1250,'retail',true,true,p_key,true,p_url)
$$;
set local role anon;
select is(jsonb_array_length(get_public_shop('public-products-test')->'products'),1,'only opted-in active retail from active matching branches is public');
select is(get_public_shop('public-products-test')->'products'->0->>'name','Visible','correct product exposed');
select is(get_public_shop('public-products-test')->'products'->0->>'priceCentavos','1250','price uses exact minor units');
select is((select array_agg(key order by key) from jsonb_object_keys(get_public_shop('public-products-test')->'products'->0) key),array['branchId','branchName','category','currency','description','id','name','priceCentavos','thumbnailUrl','unit']::text[],'public projection excludes stock, costs, codes and internal fields');
select is(get_public_shop('commerce-other-test'),null::jsonb,'unpublished business is private');
select throws_ok($$select * from inventory_items$$,'42501',null,'anonymous inventory reads denied');
select throws_ok($$select pg_temp.publish_product()$$,'42501',null,'anonymous publishing denied');
reset role;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select pg_temp.product_photo('https://example.test/product.jpg')$$,'owner saves product photo atomically');
select is(pg_temp.product_photo('https://example.test/product.jpg'),pg_temp.product_photo('https://example.test/product.jpg'),'photo retry returns original product');
select throws_ok($$select pg_temp.product_photo('https://example.test/changed.jpg')$$,'22023','Request key reused with different details','retry cannot silently replace photo');
select is(get_public_shop('public-products-test')->'products'->0->>'thumbnailUrl','https://example.test/product.jpg','photo projected for published product');
select throws_ok($$select pg_temp.product_photo('javascript:alert(1)',gen_random_uuid())$$,'22023','Invalid product photo URL','unsafe scheme rejected');
select throws_ok($$select pg_temp.product_photo('https://user:secret@example.test/photo.jpg',gen_random_uuid())$$,'22023','Invalid product photo URL','embedded credentials rejected');
select throws_ok($$update inventory_items set thumbnail_url='javascript:alert(1)' where id='c0500000-0000-4000-8000-000000000001'$$,'23514',null,'constraint protects direct writes');
select lives_ok($$select save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001','c0500000-0000-4000-8000-000000000001','Visible','','','','piece',1250,'retail',true,true,gen_random_uuid(),true)$$,'older public save remains compatible');
select is((select thumbnail_url from inventory_items where id='c0500000-0000-4000-8000-000000000001'),'https://example.test/product.jpg','older save preserves photo');
select lives_ok($$select pg_temp.product_photo('',gen_random_uuid())$$,'photo can be cleared');
select is((select thumbnail_url from inventory_items where id='c0500000-0000-4000-8000-000000000001'),null::text,'clear removes stored URL');
select lives_ok($$select pg_temp.publish_product()$$,'owner can publish in branch');
select is(pg_temp.publish_product(),pg_temp.publish_product(),'same request returns same product');
select throws_ok($$select pg_temp.publish_product(false)$$,'22023','Request key reused with different details','retry cannot change public flag');
select throws_ok($$select pg_temp.publish_product(true,gen_random_uuid(),null,'internal')$$,'22023','Internal supplies cannot be public','internal publication rejected by RPC');
select throws_ok($$select pg_temp.publish_product(true,gen_random_uuid(),'c0500000-0000-4000-8000-000000000005')$$,'42501','Product unavailable','other branch product ID cannot be changed');
select throws_ok($$select pg_temp.publish_product(true,gen_random_uuid(),'c0500000-0000-4000-8000-000000000006')$$,'42501','Product unavailable','other tenant product ID cannot be changed');
select lives_ok($$select save_commerce_product('c0200000-0000-4000-8000-000000000001','c0300000-0000-4000-8000-000000000001',null,'Legacy product','','','','piece',100,'retail',true,true,'c0700000-0000-4000-8000-000000000001')$$,'legacy save signature still works');
select is((select is_public from inventory_items where name='Legacy product'),false,'legacy creation stays private');
select lives_ok($$select pg_temp.publish_product(false,gen_random_uuid())$$,'owner can unpublish');
select is(jsonb_array_length(get_public_shop('public-products-test')->'products'),1,'unpublished product disappears');
set local "request.jwt.claims"='{"sub":"c0100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select pg_temp.publish_product(true,gen_random_uuid())$$,'42501','Product management access required','other tenant cannot publish');
reset role;
update organizations set public_page_enabled=false where id='c0200000-0000-4000-8000-000000000001';
select is(get_public_shop('public-products-test'),null::jsonb,'unpublishing the business hides products');
update organizations set public_page_enabled=true,status='suspended' where id='c0200000-0000-4000-8000-000000000001';
select is(get_public_shop('public-products-test'),null::jsonb,'suspended business hides products');
select * from finish();
rollback;
