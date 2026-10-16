"""Local-only credit race. Requires an explicitly named disposable QA database."""
import concurrent.futures
import os
import subprocess
import uuid

DB = os.environ.get('CREDIT_TEST_DATABASE', '')
CONTAINER = os.environ.get('CREDIT_TEST_CONTAINER', '')
if not DB.startswith(('negosu_credit_test_', 'negosu_usage_dashboard_')) or not CONTAINER:
    raise SystemExit('Set CREDIT_TEST_DATABASE to a disposable negosu_credit_test_* database and CREDIT_TEST_CONTAINER.')

def sql(statement):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'supabase_admin', '-d', DB, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True, check=True)
    return result.stdout

org, branch, customer, first, second = [str(uuid.uuid4()) for _ in range(5)]
try:
    sql(f"""begin;
insert into public.organizations(id,name,slug,industry) values('{org}','Synthetic credit race','race-{org}','salon');
insert into public.branches(id,organization_id,name) values('{branch}','{org}','Synthetic');
insert into public.customers(id,organization_id,full_name) values('{customer}','{org}','Synthetic');
insert into public.organization_subscriptions(organization_id,plan_id,provider,status,current_period_start,current_period_end) values('{org}','business','manual','active',now(),now()+interval '1 month');
select public.ensure_credit_period('{org}');
insert into public.organization_credit_ledger(organization_id,grant_id,transaction_type,amount,reason_code,idempotency_key)
select organization_id,id,'ADJUSTMENT',case when credit_class='plan' then 1-allowance else -allowance end,'synthetic_test','race:'||id from public.organization_credit_grants where organization_id='{org}';
insert into public.notification_outbox(id,organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,template_key,reference_type,reference_id,deduplication_key,status,locked_at,locked_by)
select id,'{org}','{branch}','{customer}','SYNTHETIC_TEST','sms','+639171234567','synthetic','synthetic',id,'race:'||id,'processing',now(),'race-worker' from unnest(array['{first}'::uuid,'{second}'::uuid]) id;
commit;""")
    def reserve(message):
        return sql(f"""begin;set local role service_role;set local \"request.jwt.claims\"='{{"role":"service_role"}}';
select public.reserve_notification_credit('{message}','race-worker',1,repeat('a',64))->>'code';
select pg_sleep(0.2);commit;""")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(reserve, [first, second]))
    assert sum('CREDIT_RESERVED' in result for result in results) == 1, results
    assert sum('INSUFFICIENT_CREDITS' in result for result in results) == 1, results
    assert sql(f"select public.credit_balance_data('{org}')->>'remaining';").strip() == '0'
    assert sql(f"select public.credit_balance_data('{org}')->>'reserved';").strip() == '1'
    print('PASS: two concurrent service-role reservations, one last credit, no overspend')
finally:
    sql(f"begin; delete from public.notification_outbox where organization_id='{org}'; delete from public.customers where organization_id='{org}'; delete from public.branches where organization_id='{org}'; delete from public.organizations where id='{org}'; commit;")
