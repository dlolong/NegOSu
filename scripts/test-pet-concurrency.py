"""Synthetic multi-session tests. Only the disposable local Pet validation DB is allowed."""
import concurrent.futures
import pathlib
import subprocess
import sys
import time
import secrets
import os

DB = os.environ.get('PET_TEST_DATABASE','negosu_pet_replay')
if DB not in {'negosu_pet_replay','negosu_pet_release_final'}: raise SystemExit('Use an allowlisted disposable local Pet database.')
PREFIX="8"+secrets.token_hex(1)[0]
if sys.argv[1:] != ['--apply-disposable-fixtures']:
    raise SystemExit('Use --apply-disposable-fixtures. Requires the local negosu_pet_replay database with the Pet migrations.')
def sql(query):
    return subprocess.run(['docker','exec','-i','supabase_db_karkr','psql','-U','supabase_admin','-d',DB,'-X','-At','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
source=pathlib.Path('supabase/tests/pet_care.sql').read_text()
fixture=source[source.index('insert into auth.users'):source.index('create temporary table')].replace('7c',PREFIX).replace('pet-a-test','pet-race-a-'+PREFIX+'-test').replace('pet-b-test','pet-race-b-'+PREFIX+'-test').replace('pet-a@','pet-race-a-'+PREFIX+'@').replace('pet-b@','pet-race-b-'+PREFIX+'@')
result=sql('begin;'+fixture+'commit;')
if result.returncode: raise SystemExit('Fixture creation failed. Use a fresh disposable validation database; fixtures are deliberately not overwritten. '+result.stderr)
def uid(kind,index):return f'{PREFIX}{kind}00000-0000-4000-8000-{index:012d}'
result=sql(f"insert into branches(id,organization_id,name,opening_hours) select '{uid(3,3)}',organization_id,'Second grooming branch',opening_hours from branches where id='{uid(3,1)}'; insert into scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity) values('{uid(8,2)}','{uid(2,1)}','{uid(3,3)}','Second room','room',2);")
assert result.returncode==0,result.stderr
def booking(pet,staff,day,branch,hold):
    return sql(f'''begin; set local role authenticated; set local "request.jwt.claims"='{{"sub":"{uid(1,1)}","role":"authenticated"}}';
select save_pet_appointment('{uid(5,pet)}',null,'{uid(3,branch)}',array['{uid(7,1)}']::uuid[],date_trunc('day',now())+interval '{day} days 2 hours',array['{uid(6,staff)}']::uuid[],array['{uid(8,1 if branch==1 else 2)}']::uuid[]);
select pg_sleep({hold}); commit;''')
def race(label,a,b,winners):
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        first=pool.submit(booking,*a,2)
        time.sleep(.25)
        second=pool.submit(booking,*b,0)
        results=[first.result(),second.result()]
    actual=sum(r.returncode==0 for r in results)
    if actual!=winners:raise SystemExit(f'FAIL {label}: {actual} commits, expected {winners}. '+str([r.stderr for r in results]))
    print(f'PASS {label}: {actual} committed; {2-actual} rejected')
race('same pet simultaneous writes',(1,1,4,1),(1,2,4,1),1)
race('busy groomer simultaneous writes',(1,1,5,1),(2,1,5,1),1)
result=sql(f"update scheduling_resources set capacity=1 where id='{uid(8,1)}';")
assert result.returncode==0,result.stderr
race('resource capacity simultaneous writes',(1,1,6,1),(2,2,6,1),1)
result=sql(f"update scheduling_resources set capacity=2 where id='{uid(8,1)}';")
assert result.returncode==0,result.stderr
race('different pets same owner with capacity',(1,1,7,1),(2,2,7,1),2)
race('same pet across branches',(1,1,8,1),(1,2,8,3),1)
race('busy groomer across branches',(1,1,9,1),(2,1,9,3),1)
result=sql(f"select count(*) from appointments where organization_id='{uid(2,1)}';")
assert result.stdout.strip()=='7', result.stdout
print('PASS failed concurrent writes left no partial appointments; seven committed appointments total')
if DB == 'negosu_pet_release_final':
    result=sql(f"update organizations set public_page_enabled=true where id='{uid(2,1)}'; update branches set accepts_public_bookings=true where id='{uid(3,1)}'; update services set is_public=true where id='{uid(7,1)}';")
    assert result.returncode==0,result.stderr
    public_request=f"select submit_pet_public_booking('pet-race-a-{PREFIX}-test','{uid(3,1)}',array['{uid(7,1)}']::uuid[],date_trunc('day',now())+interval '20 days 2 hours','Race Owner','09171234567',null,'Race Pet','dog',null,null,'pet-race-{PREFIX}','');"
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        a=pool.submit(sql,"begin;set local role anon;"+public_request+"select pg_sleep(2);commit;")
        time.sleep(.25)
        b=pool.submit(sql,"begin;set local role anon;"+public_request+"commit;")
        results=[a.result(),b.result()]
    assert sum(r.returncode==0 for r in results)==1, [r.stderr for r in results]
    print('PASS duplicate public requests: one committed request')
    request=sql(f"select id from public_booking_requests where organization_id='{uid(2,1)}' and customer_name='Race Owner';").stdout.strip()
    confirm=f'''begin;set local role authenticated;set local "request.jwt.claims"='{{"sub":"{uid(1,1)}","role":"authenticated"}}';select confirm_pet_public_booking('{request}',null,'{uid(6,1)}','{uid(8,1)}');'''
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        a=pool.submit(sql,confirm+'select pg_sleep(2);commit;')
        time.sleep(.25)
        b=pool.submit(sql,confirm+'commit;')
        results=[a.result(),b.result()]
    assert all(r.returncode==0 for r in results),[r.stderr for r in results]
    result=sql(f"select count(*) from appointments where organization_id='{uid(2,1)}';")
    assert result.stdout.strip()=='8',result.stdout
    print('PASS simultaneous confirmations: one appointment and one new pet/owner')
    visit=sql(f"select appointment_id from public_booking_requests where id='{request}';").stdout.strip()
    actor=f'''begin;set local role authenticated;set local "request.jwt.claims"='{{"sub":"{uid(1,1)}","role":"authenticated"}}';'''
    result=sql(actor+f"select transition_pet_appointment('{visit}','arrive');commit;")
    assert result.returncode==0,result.stderr
    note=actor+f"select add_pet_grooming_note('{uid(9,1)}','{visit}','Concurrent note',null);"
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        a=pool.submit(sql,note+'select pg_sleep(2);commit;')
        time.sleep(.25)
        b=pool.submit(sql,note+'commit;')
        results=[a.result(),b.result()]
    assert all(r.returncode==0 for r in results),[r.stderr for r in results]
    assert sql(f"select count(*) from pet_grooming_notes where appointment_id='{visit}';").stdout.strip()=='1'
    print('PASS simultaneous note retries: one retained note')
