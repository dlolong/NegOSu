"""Run checkout and related pgTAP suites in rollback-only transactions on local QA.
The allowlisted Docker container is the only target; no hosted credentials are read.
"""
import pathlib
import re
import subprocess
import sys

container = 'supabase_db_negosu-full-qa'
base = ['docker','exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1']
version = subprocess.run(base+['-Atc','select max(version) from supabase_migrations.schema_migrations'],capture_output=True,text=True)
if version.returncode: raise SystemExit(version.stderr)
version = version.stdout.strip()

def body(source):
    return re.sub(r'^\s*(begin|commit|rollback);', '', source, flags=re.M|re.I)

migrations='\n'.join(body(p.read_text()) for p in sorted(pathlib.Path('supabase/migrations').glob('*.sql')) if version<p.name[:4]<='0113')
names=sys.argv[1:] or ['shared_checkout','parts_reservation_consumption','service_advisor_workflow','appointment_promos','multi_service_promos','hospitality_general_availability']
failed=False
for name in names:
    if not re.fullmatch('[a-z_]+',name): raise SystemExit('Use test file names without directories or extension.')
    query='begin;\n'+migrations+'\n'+body(pathlib.Path('supabase/tests',name+'.sql').read_text())+'\nrollback;'
    result=subprocess.run(base,input=query,capture_output=True,text=True)
    target=pathlib.Path('test-results/checkout',name+'.log');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(result.stdout+'\n'+result.stderr)
    bad=result.returncode or re.search(r'not ok \d+|Looks like you (?:failed|planned)',result.stdout)
    count=re.findall(r'1\.\.(\d+)',result.stdout)
    print(('FAIL' if bad else 'PASS')+' '+name+': '+(count[-1] if count else '?')+' assertions ('+str(target)+')')
    if bad: print(result.stderr or '\n'.join(line for line in result.stdout.splitlines() if 'not ok' in line or '# ' in line))
    failed=failed or bool(bad)
sys.exit(int(failed))
