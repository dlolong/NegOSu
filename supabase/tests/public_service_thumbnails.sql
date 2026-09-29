begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into organizations(id,name,slug,public_page_enabled) values
('a1000000-0000-4000-8000-000000000001','Thumbnail Test','thumbnail-test',true),
('a1000000-0000-4000-8000-000000000002','Other Thumbnail Test','other-thumbnail-test',false);
insert into services(id,organization_id,name,duration_minutes,base_price_centavos,is_active,is_public,thumbnail_url) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Visible photo',30,10000,true,true,'https://example.test/visible.jpg'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Private photo',30,10000,true,false,'https://example.test/private.jpg'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','Other tenant photo',30,10000,true,true,'https://example.test/other.jpg');
select is(get_public_shop('thumbnail-test')->'services'->0->>'thumbnailUrl','https://example.test/visible.jpg','public thumbnail projected');
select is(jsonb_array_length(get_public_shop('thumbnail-test')->'services'),1,'private service excluded');
select is(get_public_shop('other-thumbnail-test'),null::jsonb,'unpublished business hidden');
select throws_ok($$update services set thumbnail_url='javascript:alert(1)' where id='a2000000-0000-4000-8000-000000000001'$$,'23514',null,'database rejects unsafe protocol');
select throws_ok($$update services set thumbnail_url='https://user:password@example.test/photo.jpg' where id='a2000000-0000-4000-8000-000000000001'$$,'23514',null,'database rejects credentials');
update services set thumbnail_url=null where id='a2000000-0000-4000-8000-000000000001';
select is(get_public_shop('thumbnail-test')->'services'->0->>'thumbnailUrl',null::text,'cleared thumbnail remains null');
set local role anon;
select is(jsonb_array_length(get_public_shop('thumbnail-test')->'services'),1,'anonymous projection remains available');
select throws_ok($$update services set thumbnail_url='https://example.test/forged.jpg'$$,'42501',null,'anonymous writes denied');
reset role;
select * from finish();
rollback;
