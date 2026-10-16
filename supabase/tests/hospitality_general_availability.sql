begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(35);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('b9900000-0000-4000-8000-000000000001','authenticated','authenticated','inn-owner@negosu.local.test','',now(),'{}','{}',now(),now()),
('b9900000-0000-4000-8000-000000000002','authenticated','authenticated','inn-viewer@negosu.local.test','',now(),'{}','{}',now(),now());
select ok(not has_function_privilege('anon','public.create_first_organization(text,text,text,text,text,text,text,text,text)','EXECUTE'),'anonymous cannot provision organizations');
select ok(not has_function_privilege('authenticated','public.create_hospitality_pilot(text,text,uuid)','EXECUTE'),'legacy pilot provisioning is retired');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"b9900000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select create_first_organization('Invalid Inn','hospitality','salon','invalid-inn')$$,'22023','Business type does not match organization industry','mismatched hospitality subtype rejected');
select lives_ok($$select create_first_organization('Open Signup Inn','hospitality','inn','open-signup-inn')$$,'ordinary authenticated account creates hospitality without invitation');
select is((select role::text from organization_memberships where user_id=auth.uid()),'owner','owner role assigned by database');
select is((select plan_id from organization_subscriptions where organization_id=(select organization_id from organization_memberships where user_id=auth.uid())),'free','normal Free subscription created');
select ok((select financial_report_roles_only from organizations where created_by=auth.uid()),'financial report policy applies without pilot registry');
select ok(hospitality_enabled((select id from organizations where created_by=auth.uid())),'standard organization is enabled');
select throws_ok($$update organizations set financial_report_roles_only=false where created_by=auth.uid()$$,'42501','Trusted report configuration required','owner cannot disable financial report restriction');
select lives_ok($$select create_initial_branch((select id from organizations where created_by=auth.uid()),'Main','Local test address','Test city','Test province')$$,'normal branch onboarding works');
select lives_ok($$select save_hospitality_room((select id from organizations where created_by=auth.uid()),(select id from branches where organization_id=(select id from organizations where created_by=auth.uid())),null,'101',null,null,2,true)$$,'standard organization can manage rooms');
-- Free workspace dates match the UI's month and recent custom filters.
select lives_ok(format('select get_hospitality_workspace(%L,%L,%L,%L,%L,1,%L)',
 o.id,b.id,date_trunc('month',now() at time zone b.timezone)::date,
 (now() at time zone b.timezone)::date,'stays',mode),
 'Free '||mode||' accepts this month')
 from organizations o join branches b on b.organization_id=o.id
 cross join unnest(array['payments','history','report']) mode where o.created_by=auth.uid();
select lives_ok(format('select get_hospitality_workspace(%L,%L,%L,%L,%L,1,%L)',
 o.id,b.id,(now() at time zone b.timezone)::date-10,
 (now() at time zone b.timezone)::date-3,'stays',mode),
 'Free '||mode||' accepts a recent custom period')
 from organizations o join branches b on b.organization_id=o.id
 cross join unnest(array['payments','history','report']) mode where o.created_by=auth.uid();
select lives_ok(format('select get_hospitality_workspace(%L,%L,%L,%L,%L,1,%L)',
 o.id,b.id,(now() at time zone b.timezone)::date-30,
 (now() at time zone b.timezone)::date,'stays',mode),
 'Free '||mode||' accepts the inclusive 31-day boundary')
 from organizations o join branches b on b.organization_id=o.id
 cross join unnest(array['payments','history','report']) mode where o.created_by=auth.uid();
select throws_ok(format('select get_hospitality_workspace(%L,%L,%L,%L,%L,1,%L)',
 o.id,b.id,(now() at time zone b.timezone)::date-31,
 (now() at time zone b.timezone)::date,'stays',mode),'42501',null,
 'Free '||mode||' rejects dates beyond 31 days')
 from organizations o join branches b on b.organization_id=o.id
 cross join unnest(array['payments','history','report']) mode where o.created_by=auth.uid();
select throws_ok(format('select get_hospitality_workspace(%L,%L,%L,%L,%L,1,%L)',
 o.id,b.id,(now() at time zone b.timezone)::date,
 (now() at time zone b.timezone)::date+1,'outstanding','payments'),'42501',null,
 'Free payments reject future dates')
 from organizations o join branches b on b.organization_id=o.id where o.created_by=auth.uid();
select throws_ok(format('select get_hospitality_workspace(%L,null,current_date,current_date,%L,1,%L)',
 id,'outstanding','payments'),'42501',null,'Free payments reject all branches')
 from organizations where created_by=auth.uid();
select throws_ok(format('select get_hospitality_workspace(%L,%L,current_date,current_date,%L,1,%L)',
 id,'b9900000-0000-4000-8000-ffffffffffff','outstanding','payments'),'42501','Branch not found','Payments reject a branch outside the organization')
 from organizations where created_by=auth.uid();
select is((generate_credit_report((select id from organizations where created_by=auth.uid()),'b9900000-0000-4000-8000-000000000101',jsonb_build_object('kind','hospitality','action','advanced_report','section','stays','branch',null,'start',current_date-90,'end',current_date))->>'cost')::integer,1,'Free hospitality historical filtering uses one credit');
select is((generate_credit_report((select id from organizations where created_by=auth.uid()),'b9900000-0000-4000-8000-000000000102',jsonb_build_object('kind','hospitality','action','csv_export','section','collections','branch',null,'start',current_date-90,'end',current_date))->>'cost')::integer,1,'Free hospitality CSV uses one credit');
select throws_ok($$select create_first_organization('Duplicate Inn','hospitality','inn','duplicate-inn')$$,'P0001','User already belongs to an organization','repeat provisioning cannot create another workspace');
reset role;
select is((select count(*) from hospitality_pilot_organizations where organization_id=(select id from organizations where slug='open-signup-inn')),0::bigint,'new workspace has no pilot registration');
insert into organization_memberships(organization_id,user_id,role) select id,'b9900000-0000-4000-8000-000000000002','viewer' from organizations where slug='open-signup-inn';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"b9900000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from hospitality_rooms),1::bigint,'viewer can read authorized rooms');
select throws_ok($$select get_hospitality_workspace((select id from organizations where slug='open-signup-inn'),(select id from branches where organization_id=(select id from organizations where slug='open-signup-inn')),(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,'collections',1,'report')$$,'42501',null,'viewer cannot load financial reports in standard workspace');
select throws_ok($$select get_hospitality_workspace((select id from organizations where slug='open-signup-inn'),(select id from branches where organization_id=(select id from organizations where slug='open-signup-inn')),current_date,current_date,'outstanding',1,'payments')$$,'42501','Finance access required','viewer cannot load payments');
reset role;
update organizations set status='suspended' where slug='open-signup-inn';
select ok(not hospitality_enabled((select id from organizations where slug='open-signup-inn')),'suspended organization is not enabled');
set local role authenticated;
select is((select count(*) from hospitality_rooms),0::bigint,'suspended workspace occupancy is hidden');
reset role;
select * from finish();
rollback;
