-- Local-only repair regression; schema changes are rolled back after assertions.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('85100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','billing-repair@test.local','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('85000000-0000-4000-8000-000000000001','Billing Repair','billing-repair-test');
insert into billing_orders(organization_id,created_by,request_id,plan_id,plan_name,billing_interval,amount_centavos,livemode,kind,status,checkout_session_id)
values('85000000-0000-4000-8000-000000000001','85100000-0000-4000-8000-000000000001',gen_random_uuid(),'starter','Starter','month',49900,false,'new','pending','cs_repairtest');
create temp table billing_before_repair as table public.billing_orders;
alter table public.billing_orders drop column checkout_closed_at, drop column last_checked_at;
\ir ../migrations/0085_restore_paymongo_recovery_columns.sql
select has_column('public','billing_orders','checkout_closed_at','restores provider closure tracking');
select has_column('public','billing_orders','last_checked_at','restores reconciliation scheduling');
select is((select count(*) from billing_orders),(select count(*) from billing_before_repair),'repair preserves every order');
select is((select count(*) from billing_orders o join billing_before_repair b using(id) where o.status is distinct from b.status or o.amount_centavos is distinct from b.amount_centavos or o.provider_payment_id is distinct from b.provider_payment_id),0::bigint,'repair preserves payment statuses, amounts and identities');
select ok((select relrowsecurity from pg_class where oid='public.billing_orders'::regclass),'repair preserves RLS');
select ok(not has_table_privilege('authenticated','public.billing_orders','UPDATE'),'clients still cannot change orders');
update billing_orders set last_checked_at='2026-01-01',checkout_closed_at='2026-01-02';
\ir ../migrations/0085_restore_paymongo_recovery_columns.sql
select is((select count(*) from billing_orders where last_checked_at is distinct from '2026-01-01'::timestamptz or checkout_closed_at is distinct from '2026-01-02'::timestamptz),0::bigint,'reapplying repair preserves existing tracking');
select * from finish();
rollback;
