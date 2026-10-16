"""Credit races against a disposable local validation database only. Synthetic prices."""
import concurrent.futures
import re
import subprocess
import sys
import time
import uuid
if len(sys.argv) != 3 or sys.argv[1] != '--local-disposable-database' or not re.fullmatch(r'negosu_(?:trial_credits|usage_dashboard)_[a-z0-9_]+', sys.argv[2]):
    raise SystemExit('Use --local-disposable-database negosu_usage_dashboard_<unique suffix>.')
database = sys.argv[2]
org, actor, branch, customer, first, second = (str(uuid.uuid4()) for _ in range(6))
def sql(query):
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_negosu-full-qa', 'psql', '-U', 'supabase_admin', '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'], input=query.encode(), capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr.decode())
    return r.stdout.decode().strip()
auth = '''set local role service_role;set local "request.jwt.claims"='{"role":"service_role"}';'''
def reserve(message): return f"select reserve_notification_credit('{message}','race-worker')->>'code';"
def race(a,b,claims=auth):
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        one = pool.submit(sql, 'begin;'+claims+a+'select pg_sleep(1);commit;')
        time.sleep(.15)
        two = pool.submit(sql, 'begin;'+claims+b+'commit;')
        return [one.result(), two.result()]
previous = sql("select json_build_object('cost',credit_cost,'enabled',enabled)::text from credit_operation_registry where operation_key='sms_notification'")
import json
config=json.loads(previous)
plan=json.loads(sql("select json_build_object('allowance',monthly_credits,'policy',credit_grant_policy)::text from plans where id='business'"))
try:
    sql(f"""begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('{actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{actor}@race.test','','{{}}','{{}}',now(),now());
    insert into organizations(id,name,slug,industry) values('{org}','Synthetic race','credit-race-{org}','salon');
    insert into organization_memberships(organization_id,user_id,role) values('{org}','{actor}','owner');
    insert into branches(id,organization_id,name) values('{branch}','{org}','Main');
    insert into customers(id,organization_id,full_name) values('{customer}','{org}','Synthetic');
    insert into organization_subscriptions(organization_id,plan_id,provider,status,current_period_end) values('{org}','business','manual','active',now()+interval '1 month') on conflict(organization_id) do update set plan_id='business',provider='manual',status='active',current_period_end=excluded.current_period_end;
    insert into trial_credit_accounts(organization_id,remaining) values('{org}',1);
    update credit_operation_registry set credit_cost=1,enabled=true where operation_key='sms_notification';
    insert into notification_outbox(id,organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,template_key,reference_type,reference_id,deduplication_key,status,locked_at,locked_by)
    select x,'{org}','{branch}','{customer}','SYNTHETIC','sms','+639171234567','synthetic','synthetic',x,'synthetic-race-'||x,'processing',now(),'race-worker' from unnest(array['{first}'::uuid,'{second}'::uuid])x;
    commit;""")
    results=race(reserve(first),reserve(second))
    assert 'CREDIT_RESERVED' in results[0] and 'INSUFFICIENT_CREDITS' in results[1], results
    print('PASS two operations compete for last credit: one reservation', flush=True)
    results=race(reserve(first),reserve(first))
    assert all('CREDIT_RESERVED' in result for result in results), results
    assert sql(f"select count(*) from organization_credit_reservations where organization_id='{org}'")=='1'
    print('PASS concurrent duplicate requests reuse one reservation', flush=True)
    sql(f"begin;{auth}select record_notification_delivery_result('{first}','race-worker','sent','synthetic','synthetic-accepted');commit;")
    assert sql(f"select credit_balance_data('{org}')->>'remaining'")=='0'
    assert sql(f"select count(*) from organization_credit_ledger where organization_id='{org}' and transaction_type='USAGE'")=='1'
    print('PASS accepted operation commits one debit with nonnegative balance', flush=True)
    sql("update plans set monthly_credits=10,credit_grant_policy='calendar_month_utc' where id='business'")
    owner_auth = f'''set local role authenticated;set local "request.jwt.claims"='{{"sub":"{actor}","role":"authenticated"}}';'''
    grant=f"select get_credit_usage('{org}')->>'monthlyRemaining';"
    results=race(grant,grant,owner_auth)
    assert sql(f"select count(*) from organization_credit_grants where organization_id='{org}' and credit_class='plan'")=='1'
    assert sql(f"select credit_balance_data('{org}')->>'monthlyRemaining'")=='10'
    print('PASS concurrent monthly initialization grants the period only once',flush=True)
finally:
    cost='null' if config['cost'] is None else str(int(config['cost']))
    allowance='null' if plan['allowance'] is None else str(int(plan['allowance']))
    policy='null' if plan['policy'] is None else "'"+plan['policy'].replace("'","''")+"'"
    # Restore synthetic commercial settings independently, even if fixture cleanup fails.
    sql(f"begin;update credit_operation_registry set credit_cost={cost},enabled={str(bool(config['enabled'])).lower()} where operation_key='sms_notification';update plans set monthly_credits={allowance},credit_grant_policy={policy} where id='business';commit;")
    sql(f"begin;delete from notification_outbox where organization_id='{org}';delete from customers where organization_id='{org}';delete from branches where organization_id='{org}';delete from organizations where id='{org}';delete from auth.users where id='{actor}';commit;")
