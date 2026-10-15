begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('13710000-0000-4000-8000-000000000001','authenticated','authenticated','style-owner@example.test','',now(),'{}','{}',now(),now()),
('13710000-0000-4000-8000-000000000002','authenticated','authenticated','style-manager@example.test','',now(),'{}','{}',now(),now()),
('13710000-0000-4000-8000-000000000003','authenticated','authenticated','style-viewer@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,public_page_enabled,industry) values
('13720000-0000-4000-8000-000000000001','Theme A','style-business-a',true,'salon'),
('13720000-0000-4000-8000-000000000002','Theme B','style-business-b',false,'automotive');
insert into organization_memberships(organization_id,user_id,role) values
('13720000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001','owner'),
('13720000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000002','manager'),
('13720000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000003','viewer');
insert into organization_subscriptions(organization_id,plan_id,status) values
('13720000-0000-4000-8000-000000000001','free','active')
on conflict (organization_id) do update set plan_id='free',status='active';
select is((select public_page_style from organizations where slug='style-business-a'),'standard','existing businesses default to Standard');
set local role authenticated;
select set_config('request.jwt.claim.sub','13710000-0000-4000-8000-000000000001',true);
select lives_ok($$update organizations set public_page_style='elegant',public_page_theme='crimson',public_hero_headline='Hello',public_hero_position='right' where slug='style-business-a'$$,'free-plan owner can save own industry style and crimson');
select lives_ok($$update organizations set public_page_style='elegant' where slug='style-business-a'$$,'repeated save is harmless');
select throws_ok($$update organizations set public_page_style='precision' where slug='style-business-a'$$,'23514',null,'salon cannot select automotive style');
select throws_ok($$update organizations set public_page_style='unknown' where slug='style-business-a'$$,'23514',null,'unknown styles rejected');
select throws_ok($$update organizations set public_hero_headline=repeat('x',121) where slug='style-business-a'$$,'23514',null,'headline length enforced');
select throws_ok($$update organizations set public_hero_eyebrow=repeat('x',61) where slug='style-business-a'$$,'23514',null,'eyebrow length enforced');
select throws_ok($$update organizations set public_hero_description=repeat('x',301) where slug='style-business-a'$$,'23514',null,'supporting text length enforced');
select throws_ok($$update organizations set public_hero_position='url(evil)' where slug='style-business-a'$$,'23514',null,'image position allowlist enforced');
with changed as (update organizations set public_page_style='precision' where slug='style-business-b' returning id)
select is((select count(*)::integer from changed),0,'cross-tenant style write denied');
select set_config('request.jwt.claim.sub','13710000-0000-4000-8000-000000000002',true);
select lives_ok($$update organizations set public_hero_headline='Manager welcome' where slug='style-business-a'$$,'manager can edit public presentation');
select set_config('request.jwt.claim.sub','13710000-0000-4000-8000-000000000003',true);
with changed as (update organizations set public_page_style='standard' where slug='style-business-a' returning id)
select is((select count(*)::integer from changed),0,'viewer cannot save style');
reset role;
update organization_memberships set is_active=false where user_id='13710000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','13710000-0000-4000-8000-000000000002',true);
with changed as (update organizations set public_page_style='standard' where slug='style-business-a' returning id)
select is((select count(*)::integer from changed),0,'inactive manager cannot save style');
set local role anon;
select is(get_public_shop('style-business-a')->>'pageStyle','elegant','published style projected');
select is(get_public_shop('style-business-a')->'hero'->>'headline','Manager welcome','public hero text projected');
select is(get_public_shop('style-business-a')->'hero'->>'position','right','image position projected');
select is(get_public_shop('style-business-b'),null::jsonb,'unpublished style remains private');
select throws_ok($$update organizations set public_page_style='standard' where slug='style-business-a'$$,'42501',null,'anonymous mutation denied');
reset role;
select is((select public_page_style from organizations where slug='style-business-b'),'standard','other tenant unchanged');
select lives_ok($$update organizations set public_page_style='precision' where slug='style-business-b'$$,'automotive supports Precision');
select throws_ok($$update organizations set public_page_style='elegant' where slug='style-business-b'$$,'23514',null,'automotive rejects Elegant');
insert into organizations(name,slug,industry) values ('Inn','style-test-inn','hospitality'),('Pets','style-test-pets','pet_care');
select lives_ok($$update organizations set public_page_style='retreat' where slug='style-test-inn'$$,'hospitality supports Retreat');
select lives_ok($$update organizations set public_page_style='friendly' where slug='style-test-pets'$$,'pet care supports Friendly');
select throws_ok($$update organizations set public_page_style='elegant' where slug in ('style-test-inn','style-test-pets')$$,'23514',null,'other industries reject Elegant');
select lives_ok($$update organizations set public_page_style='standard' where slug='style-business-a'$$,'can switch back to Standard');
select is((select public_hero_headline from organizations where slug='style-business-a'),'Manager welcome','switching to Standard retains custom text');
update organizations set status='suspended' where slug='style-business-a';
set local role anon;
select is(get_public_shop('style-business-a'),null::jsonb,'suspended business stays private');
select ok((select relrowsecurity from pg_class where oid='public.organizations'::regclass),'RLS stays enabled');
select * from finish();
rollback;
