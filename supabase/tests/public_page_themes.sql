begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('13610000-0000-4000-8000-000000000001','authenticated','authenticated','theme-owner@example.test','',now(),'{}','{}',now(),now()),
('13610000-0000-4000-8000-000000000002','authenticated','authenticated','theme-manager@example.test','',now(),'{}','{}',now(),now()),
('13610000-0000-4000-8000-000000000003','authenticated','authenticated','theme-viewer@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,public_page_enabled) values
('13620000-0000-4000-8000-000000000001','Theme A','theme-business-a',true),
('13620000-0000-4000-8000-000000000002','Theme B','theme-business-b',false);
insert into organization_memberships(organization_id,user_id,role) values
('13620000-0000-4000-8000-000000000001','13610000-0000-4000-8000-000000000001','owner'),
('13620000-0000-4000-8000-000000000001','13610000-0000-4000-8000-000000000002','manager'),
('13620000-0000-4000-8000-000000000001','13610000-0000-4000-8000-000000000003','viewer');
insert into organization_subscriptions(organization_id,plan_id,status) values
('13620000-0000-4000-8000-000000000001','free','active')
on conflict (organization_id) do update set plan_id='free',status='active';
select is((select public_page_theme from organizations where slug='theme-business-a'),'classic','existing-style default');

set local role authenticated;
select set_config('request.jwt.claim.sub','13610000-0000-4000-8000-000000000001',true);
select lives_ok($$update organizations set public_page_theme='plum' where id='13620000-0000-4000-8000-000000000001'$$,'owner can save on free plan');
select is((select public_page_theme from organizations where id='13620000-0000-4000-8000-000000000001'),'plum','choice persists');
select lives_ok($$update organizations set public_page_theme='plum' where id='13620000-0000-4000-8000-000000000001'$$,'repeated save is harmless');
select throws_ok($$update organizations set public_page_theme='url(evil)' where id='13620000-0000-4000-8000-000000000001'$$,'23514',null,'database rejects unsupported themes');
select throws_ok($$update organizations set public_page_theme=null where id='13620000-0000-4000-8000-000000000001'$$,'23502',null,'database rejects null themes');
with changed as (update organizations set public_page_theme='teal' where id='13620000-0000-4000-8000-000000000002' returning id)
select is((select count(*)::integer from changed),0,'cross-tenant theme changes denied');

select set_config('request.jwt.claim.sub','13610000-0000-4000-8000-000000000002',true);
update organizations set public_page_theme='teal' where id='13620000-0000-4000-8000-000000000001';
select is((select public_page_theme from organizations where id='13620000-0000-4000-8000-000000000001'),'teal','manager can save');
select set_config('request.jwt.claim.sub','13610000-0000-4000-8000-000000000003',true);
with changed as (update organizations set public_page_theme='indigo' where id='13620000-0000-4000-8000-000000000001' returning id)
select is((select count(*)::integer from changed),0,'viewer cannot save');
reset role;
update organization_memberships set is_active=false where user_id='13610000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','13610000-0000-4000-8000-000000000002',true);
with changed as (update organizations set public_page_theme='indigo' where id='13620000-0000-4000-8000-000000000001' returning id)
select is((select count(*)::integer from changed),0,'inactive manager cannot save');

set local role anon;
select is(get_public_shop('theme-business-a')->>'theme','teal','published business exposes selected theme');
select is(get_public_shop('theme-business-b'),null::jsonb,'unpublished business stays private');
select is(get_public_shop('missing-theme-business'),null::jsonb,'unknown business stays unavailable');
select throws_ok($$update organizations set public_page_theme='plum' where id='13620000-0000-4000-8000-000000000001'$$,'42501',null,'anonymous mutations denied');
reset role;
select is((select public_page_theme from organizations where slug='theme-business-b'),'classic','other business unchanged');
update organizations set status='suspended' where slug='theme-business-a';
set local role anon;
select is(get_public_shop('theme-business-a'),null::jsonb,'suspended business stays private');
select ok((select relrowsecurity from pg_class where oid='public.organizations'::regclass),'organization RLS remains enabled');
select * from finish();
rollback;
