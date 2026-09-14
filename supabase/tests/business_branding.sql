begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10680000-0000-4000-8000-000000000001','authenticated','authenticated','branding-owner@example.test','',now(),'{}','{}',now(),now()),
('10680000-0000-4000-8000-000000000002','authenticated','authenticated','branding-manager@example.test','',now(),'{}','{}',now(),now()),
('10680000-0000-4000-8000-000000000003','authenticated','authenticated','branding-viewer@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,logo_url,public_page_enabled) values
('20680000-0000-4000-8000-000000000001','Business A','branding-business-a','https://example.test/a.png',true),
('20680000-0000-4000-8000-000000000002','Business B','branding-business-b','https://example.test/b.png',false);
insert into organization_memberships(organization_id,user_id,role) values
('20680000-0000-4000-8000-000000000001','10680000-0000-4000-8000-000000000001','owner'),
('20680000-0000-4000-8000-000000000001','10680000-0000-4000-8000-000000000002','manager'),
('20680000-0000-4000-8000-000000000001','10680000-0000-4000-8000-000000000003','viewer');

set local role authenticated;
select set_config('request.jwt.claim.sub','10680000-0000-4000-8000-000000000001',true);
update organizations set logo_url='https://example.test/owner.png' where id='20680000-0000-4000-8000-000000000001';
select is((select logo_url from organizations where id='20680000-0000-4000-8000-000000000001'),'https://example.test/owner.png','owner can update own business logo');
with changed as (update organizations set logo_url='https://example.test/spoof.png' where id='20680000-0000-4000-8000-000000000002' returning id)
select is((select count(*)::integer from changed),0,'cross-tenant logo update is denied');
select is((select count(*)::integer from organizations where id='20680000-0000-4000-8000-000000000002'),0,'private business identity is tenant isolated');

select set_config('request.jwt.claim.sub','10680000-0000-4000-8000-000000000002',true);
update organizations set logo_url='https://example.test/manager.png' where id='20680000-0000-4000-8000-000000000001';
select is((select logo_url from organizations where id='20680000-0000-4000-8000-000000000001'),'https://example.test/manager.png','manager can update business branding');
update organizations set logo_url=null where id='20680000-0000-4000-8000-000000000001';
select is((select logo_url from organizations where id='20680000-0000-4000-8000-000000000001'),null,'logo removal supports business-initial fallback');

select set_config('request.jwt.claim.sub','10680000-0000-4000-8000-000000000003',true);
with changed as (update organizations set logo_url='https://example.test/viewer.png' where id='20680000-0000-4000-8000-000000000001' returning id)
select is((select count(*)::integer from changed),0,'viewer cannot change business branding');

reset role;
update organizations set logo_url='https://example.test/a.png' where id='20680000-0000-4000-8000-000000000001';
update organization_memberships set is_active=false where user_id='10680000-0000-4000-8000-000000000003';
set local role authenticated;
select is((select count(*)::integer from organizations where id='20680000-0000-4000-8000-000000000001'),0,'inactive member cannot read private workspace identity');

set local role anon;
select is(get_public_shop('branding-business-a')->>'logoUrl','https://example.test/a.png','published storefront exposes the matching business logo');
select is(get_public_shop('branding-business-b'),null,'unpublished storefront exposes no business branding');
select is(get_public_booking_status(repeat('0',64)),null,'unknown booking token exposes no branding');
select ok(not (get_public_estimate_approval(repeat('0',64)) ? 'business'),'unknown estimate token exposes no branding');
select ok(not (get_public_appointment_self_service(repeat('0',64)) ? 'logoUrl'),'unknown appointment token exposes no branding');
select ok((select relrowsecurity from pg_class where oid='public.organizations'::regclass),'organization RLS stays enabled');
select * from finish();
rollback;
