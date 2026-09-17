-- Synthetic currency regression; every write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
values ('10970000-0000-4000-8000-000000000001','authenticated','authenticated','currency-qa@example.test','{}','{}');
insert into organizations(id,name,slug,industry,currency,public_page_enabled)
values ('20970000-0000-4000-8000-000000000001','Currency QA','currency-qa','salon','USD',true),
('20970000-0000-4000-8000-000000000002','Private currency QA','currency-private','salon','EUR',false);
insert into organization_memberships(organization_id,user_id,role)
values ('20970000-0000-4000-8000-000000000001','10970000-0000-4000-8000-000000000001','owner');
insert into branches(id,organization_id,name,is_primary)
values ('30970000-0000-4000-8000-000000000001','20970000-0000-4000-8000-000000000001','Main',true);
insert into customers(id,organization_id,full_name)
values ('40970000-0000-4000-8000-000000000001','20970000-0000-4000-8000-000000000001','Synthetic Client');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos,currency,is_public)
values ('50970000-0000-4000-8000-000000000001','20970000-0000-4000-8000-000000000001','Test service',30,50000,'USD',true);
insert into appointments(id,organization_id,branch_id,customer_id,starts_at,ends_at,expected_total_centavos)
values ('60970000-0000-4000-8000-000000000001','20970000-0000-4000-8000-000000000001','30970000-0000-4000-8000-000000000001','40970000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day 30 minutes',50000);
insert into appointment_self_service_links(organization_id,branch_id,appointment_id,token_hash,expires_at)
values ('20970000-0000-4000-8000-000000000001','30970000-0000-4000-8000-000000000001','60970000-0000-4000-8000-000000000001',repeat('9',64),now()+interval '2 days');
set local role authenticated;
set local request.jwt.claims='{"sub":"10970000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select record_appointment_payment('60970000-0000-4000-8000-000000000001',10000,'cash','currency-payment-request')$$,'owner records a partial payment');
select is((select currency from payments where appointment_id='60970000-0000-4000-8000-000000000001'),'USD','appointment payment records authoritative organization currency');
select lives_ok($$select record_appointment_payment('60970000-0000-4000-8000-000000000001',10000,'cash','currency-payment-request')$$,'identical payment retry remains safe');
select is((select count(*)::int from payments where appointment_id='60970000-0000-4000-8000-000000000001'),1,'retry creates no duplicate payment');
select throws_ok($$select record_appointment_payment('60970000-0000-4000-8000-000000000001',10001,'cash','currency-payment-request')$$,null,null,'changed retry payload is rejected');
select throws_ok($$select record_appointment_payment('60970000-0000-4000-8000-000000000001',50000,'cash','currency-overpayment-request')$$,null,null,'overpayment remains rejected');
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
select ok(not has_function_privilege('anon','public.record_appointment_payment(uuid,bigint,public.payment_method,text,text,text)','EXECUTE'),'anonymous role has no inherited payment execution grant');
select is(get_public_shop('currency-qa')->>'currency','USD','public storefront exposes organization currency');
select is(get_public_shop('currency-qa')->'services'->0->>'currency','USD','public service exposes its stored currency');
select is(get_public_appointment_self_service(repeat('9',64))->>'currency','USD','valid appointment link exposes correct currency');
select is(get_public_appointment_self_service(repeat('9',64))->>'paymentStatus','partial','currency projection preserves separate payment status');
select is(get_public_shop('currency-private'),null,'unpublished foreign business remains hidden');
select ok(not (get_public_appointment_self_service(repeat('8',64)) ? 'currency'),'invalid appointment token exposes no currency');
select ok(not (get_public_estimate_approval(repeat('8',64)) ? 'business'),'invalid estimate token exposes no business');
select throws_ok($$select record_appointment_payment('60970000-0000-4000-8000-000000000001',10000,'cash','anonymous-currency-request')$$,null,null,'anonymous payment execution remains denied');
select * from finish();
rollback;
