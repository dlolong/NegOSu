begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select is((select (features->>'image_uploads')::boolean from plans where id='free'),false,'Free cannot upload');
select is((select (features->>'image_uploads')::boolean from plans where id='starter'),true,'Starter can upload');
select ok(not exists(
 select 1 from plans where id in ('starter','business','pro','multi_branch')
 and (jsonb_typeof(limits->'storage_mb') is distinct from 'number'
   or not ((limits->>'storage_mb')::numeric = -1 or (limits->>'storage_mb')::numeric > 0))
),'paid plans have usable storage allowances after hosted prerequisite repair');
select is((select file_size_limit from storage.buckets where id='business-images'),2097152::bigint,'bucket has file size limit');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','upload-owner@test.local','','{}','{}',now(),now());
insert into organizations(id,name,slug) values('a1200000-0000-4000-8000-000000000001','Upload test','upload-test');
insert into organization_memberships(organization_id,user_id,role) values('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','owner');
insert into organization_subscriptions(organization_id,plan_id,status) values('a1200000-0000-4000-8000-000000000001','free','free') on conflict(organization_id) do update set plan_id='free',status='free';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a1100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(can_upload_business_image('a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000001.jpg','{}'),false,'free owner rejected');
reset role;
update organization_subscriptions set plan_id='starter',status='active',provider='manual',current_period_end=now()+interval '1 month' where organization_id='a1200000-0000-4000-8000-000000000001';
set local role authenticated;
select is(can_upload_business_image('a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000001.jpg','{}'),true,'paid owner accepted');
select is(can_upload_business_image('a1200000-0000-4000-8000-000000000002/a1300000-0000-4000-8000-000000000001.jpg','{}'),false,'other tenant rejected');
select is(can_upload_business_image('invalid/filename.svg','{}'),false,'unsafe object path rejected');
reset role;
-- Transactional metadata-only fixtures validate the final persistence trigger;
-- no Storage object bytes are created by this SQL test.
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values('business-images','a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000001.jpg','{"size":100}')$$,'final upload accepts valid size');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('business-images','a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000002.jpg','{"size":2097153}')$$,'23514','Invalid image size or storage allowance','oversized final object rejected');
update plans set limits=jsonb_set(limits,'{storage_mb}','0') where id='starter';
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('business-images','a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000003.jpg','{"size":100}')$$,'23514','Image storage limit reached','quota enforced at final persistence');
update organization_subscriptions set status='free',plan_id='free' where organization_id='a1200000-0000-4000-8000-000000000001';
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('business-images','a1200000-0000-4000-8000-000000000001/a1300000-0000-4000-8000-000000000004.jpg','{"size":100}')$$,'42501','Image uploads require an eligible plan','downgrade blocks new objects');
select is((select count(*) from storage.objects where bucket_id='business-images' and name like 'a1200000-0000-4000-8000-000000000001/%'),1::bigint,'downgrade preserves old images');
select * from finish();
rollback;
