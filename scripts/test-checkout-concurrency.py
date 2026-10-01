"""Checkout races against a disposable copy of the allowlisted local QA database.
No hosted connection strings are accepted. The temporary database is dropped in finally.
"""
import concurrent.futures
import pathlib
import re
import subprocess
import sys
import time
import uuid

if sys.argv[1:] != ['--local-disposable-copy']:
    raise SystemExit('Use --local-disposable-copy (local Docker QA database only).')
container = 'supabase_db_negosu-full-qa'
database = 'checkout_race_' + uuid.uuid4().hex[:12]

def command(args, data=None):
    return subprocess.run(['docker', 'exec', '-i', container, *args], input=data, capture_output=True)

def sql(query):
    return command(['psql', '-U', 'supabase_admin', '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'], query.encode())

def run(query):
    r = sql(query)
    if r.returncode: raise RuntimeError(r.stderr.decode())
    return r.stdout.decode().strip()

try:
    dump = command(['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'])
    if dump.returncode: raise RuntimeError('Local snapshot failed: '+dump.stderr.decode())
    created = command(['createdb', '-U', 'supabase_admin', database])
    if created.returncode: raise RuntimeError(created.stderr.decode())
    restored = command(['pg_restore', '-U', 'supabase_admin', '-d', database, '--no-owner', '--exit-on-error'], dump.stdout)
    if restored.returncode: raise RuntimeError(restored.stderr.decode())
    version = run('select max(version) from supabase_migrations.schema_migrations')
    for path in sorted(pathlib.Path('supabase/migrations').glob('*.sql')):
        if version < path.name[:4] <= '0111': run(path.read_text())
    fixture = pathlib.Path('supabase/tests/shared_checkout.sql').read_text()
    fixture = fixture[fixture.index('create function pg_temp.cid'):fixture.index('select is((get_checkout')]
    fixture = fixture.replace('pg_temp.cid', 'public.checkout_test_id').replace('create temporary table ctx', 'create table public.ctx').replace("'opening',10", "'opening',1")
    run('begin;'+fixture+'commit;')
    actor = run("select checkout_test_id('owner')")
    a = run("select id from ctx where name='salon'")
    prefix = f'''begin;set local role authenticated;set local "request.jwt.claims"='{{"sub":"{actor}","role":"authenticated"}}';'''
    b = run(prefix+"select open_checkout(checkout_test_id('branch-salon'),null,null,checkout_test_id('customer-salon'),checkout_test_id('race-retail'));commit;").splitlines()[-2]
    def race(label, first, second, expected):
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            one = pool.submit(sql,prefix+first+';select pg_sleep(1);commit;')
            time.sleep(.15)
            two = pool.submit(sql,prefix+second+';commit;')
            results = [one.result(), two.result()]
        assert sum(r.returncode==0 for r in results)==expected, [r.stderr.decode() for r in results]
        print(f'PASS {label}: {expected} successful transactions')
    race('last unit reserved by only one checkout',
         f"select save_checkout_product('{a}',null,null,checkout_test_id('item-salon'),1,checkout_test_id('race-a'))",
         f"select save_checkout_product('{b}',null,null,checkout_test_id('item-salon'),1,checkout_test_id('race-b'))",1)
    line=run(f"select id from checkout_lines where checkout_id='{a}' and removed_at is null")
    handover=f"select fulfill_checkout_product('{a}','{line}',1,'handover',checkout_test_id('race-handover'))"
    race('same handover retry',handover,handover,2)
    assert run("select inventory_item_balance(checkout_test_id('item-salon'))")=='0.000'
    assert run("select count(*) from inventory_movements where inventory_item_id=checkout_test_id('item-salon') and movement_type='usage'")=='1'
    run(prefix+f"select finalize_checkout('{a}',checkout_test_id('race-finalize'));commit;")
    payment=f"select record_checkout_payment('{a}',12500,'cash',null,current_date,checkout_test_id('race-payment'))"
    race('same payment retry',payment,payment,2)
    assert run("select count(*) from payments where organization_id=checkout_test_id('salon')")=='2'
    assert run(prefix+f"select get_checkout('{a}')->>'balance';commit;").splitlines()[-2]=='0'
    print('PASS one stock deduction and one payment allocation per bill; zero remaining balance')
finally:
    # Only the generated disposable name is ever removed; the source remains unchanged.
    if re.fullmatch(r'checkout_race_[0-9a-f]{12}',database):
        cleanup=command(['dropdb','-U','supabase_admin','--if-exists','--force',database])
        if cleanup.returncode: print('Temporary database cleanup failed: '+cleanup.stderr.decode(),file=sys.stderr)
