begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.cid(text) returns uuid language sql immutable as $$select md5('client-purchase-test-'||$1)::uuid$$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select pg_temp.cid(u),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u||'@client-purchase.example.test','',now(),'{}','{}',now(),now() from unnest(array['owner','outsider','cashier','technician'])u;
insert into organizations(id,name,slug,industry) select pg_temp.cid(v),v,'client-purchase-test-'||replace(v,'_','-'),v from unnest(array['salon','pet_care','automotive','hospitality'])v;
insert into organizations(id,name,slug,industry) values(pg_temp.cid('other'),'Other','client-purchase-test-other','salon');
insert into organization_memberships(id,organization_id,user_id,role) select pg_temp.cid('member-'||v),pg_temp.cid(v),pg_temp.cid('owner'),'owner' from unnest(array['salon','pet_care','automotive','hospitality'])v;
insert into organization_memberships(id,organization_id,user_id,role) values(pg_temp.cid('cashier-member'),pg_temp.cid('salon'),pg_temp.cid('cashier'),'cashier'),(pg_temp.cid('tech-member'),pg_temp.cid('salon'),pg_temp.cid('technician'),'technician'),(pg_temp.cid('other-member'),pg_temp.cid('other'),pg_temp.cid('outsider'),'owner');
insert into branches(id,organization_id,name,is_primary) select pg_temp.cid('branch-'||v),pg_temp.cid(v),'Main',true from unnest(array['salon','pet_care','automotive','hospitality','other'])v;
insert into branches(id,organization_id,name,is_primary) values(pg_temp.cid('second-branch'),pg_temp.cid('salon'),'Other',false);
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values(pg_temp.cid('salon'),pg_temp.cid('cashier-member'),pg_temp.cid('branch-salon'));
insert into customers(id,organization_id,full_name) select pg_temp.cid('customer-'||v),pg_temp.cid(v),'Checkout Client' from unnest(array['salon','pet_care','automotive','hospitality','other'])v;
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) select pg_temp.cid('service-'||v),pg_temp.cid(v),'Existing service',30,10000 from unnest(array['salon','pet_care'])v;
insert into inventory_items(id,organization_id,branch_id,name,sku,category,unit,sell_price_centavos,product_purpose) select pg_temp.cid('item-'||v),pg_temp.cid(v),pg_temp.cid('branch-'||v),'Retail bottle','BOTTLE','Care','bottle',2500,'retail' from unnest(array['salon','pet_care','automotive','hospitality','other'])v;
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos,product_purpose) values(pg_temp.cid('second-item'),pg_temp.cid('salon'),pg_temp.cid('second-branch'),'Other branch','piece',1000,'retail'),(pg_temp.cid('supply'),pg_temp.cid('salon'),pg_temp.cid('branch-salon'),'Internal supply','ml',500,'internal');
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,note) select organization_id,branch_id,id,'opening',10,'Test opening stock' from inventory_items where sku='BOTTLE';
-- Canonical appointment snapshots; no product quantities are inferred from past visits.
insert into appointments(id,organization_id,branch_id,customer_id,starts_at,expected_duration_minutes,status) select pg_temp.cid('appointment-'||v),pg_temp.cid(v),pg_temp.cid('branch-'||v),pg_temp.cid('customer-'||v),now()-interval '1 hour',30,'completed' from unnest(array['salon','pet_care'])v;
insert into appointment_services(appointment_id,service_id) select pg_temp.cid('appointment-'||v),pg_temp.cid('service-'||v) from unnest(array['salon','pet_care'])v;
insert into pet_profiles(id,organization_id,customer_id,name,species) values(pg_temp.cid('pet'),pg_temp.cid('pet_care'),pg_temp.cid('customer-pet_care'),'Test pet','dog');
insert into pet_appointment_details(appointment_id,organization_id,pet_id,customer_id_snapshot,pet_name_snapshot) values(pg_temp.cid('appointment-pet_care'),pg_temp.cid('pet_care'),pg_temp.cid('pet'),pg_temp.cid('customer-pet_care'),'Test pet');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number) values(pg_temp.cid('vehicle'),pg_temp.cid('automotive'),pg_temp.cid('customer-automotive'),'Toyota','Test','CHECKOUT-01');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values(pg_temp.cid('service-automotive'),pg_temp.cid('automotive'),'Approved labor',30,10000);
insert into appointments(id,organization_id,branch_id,customer_id,vehicle_id,starts_at,expected_duration_minutes,status) values(pg_temp.cid('appointment-automotive'),pg_temp.cid('automotive'),pg_temp.cid('branch-automotive'),pg_temp.cid('customer-automotive'),pg_temp.cid('vehicle'),now()-interval '1 hour',30,'completed');
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status) values(pg_temp.cid('job'),pg_temp.cid('automotive'),pg_temp.cid('branch-automotive'),pg_temp.cid('customer-automotive'),pg_temp.cid('vehicle'),1,'ready_for_release');
insert into job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes) values(pg_temp.cid('automotive'),pg_temp.cid('job'),pg_temp.cid('service-automotive'),'Approved labor',1,10000,10000,30);
update job_orders set appointment_id=pg_temp.cid('appointment-automotive') where id=pg_temp.cid('job');
create temporary table ctx(name text primary key,id uuid,line uuid,bill uuid);
grant all on ctx to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid('owner'),'role','authenticated')::text,true);
-- Neutral invoice adapter fixtures for automotive and hospitality; existing charges are not recreated by checkout.
insert into ctx(name,bill) select v,create_manual_invoice(pg_temp.cid(v),pg_temp.cid('branch-'||v),'Checkout Client') from unnest(array['hospitality'])v;
select add_manual_invoice_charge(bill,'Existing agreed charge',1,10000,pg_temp.cid('charge-'||name)) from ctx;
select create_estimate(pg_temp.cid('job'),0,0,null);
select record_estimate_authorization((select id from estimates where job_order_id=pg_temp.cid('job')),'approve','in_person','Agreed service');
insert into ctx(name,bill) values('automotive',issue_invoice(pg_temp.cid('job'),(select id from estimates where job_order_id=pg_temp.cid('job')),null));
insert into organization_subscriptions(organization_id,plan_id,status)
select pg_temp.cid(v),'pro','active' from unnest(array['salon','pet_care','automotive','hospitality','other'])v;
insert into hospitality_rooms(id,organization_id,branch_id,name,capacity) values(pg_temp.cid('room'),pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),'Room 1',2);
insert into hospitality_stays(id,organization_id,branch_id,room_id,guest_id,room_name_snapshot,guest_name_snapshot,occupants,request_key)
values(pg_temp.cid('stay'),pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),pg_temp.cid('room'),pg_temp.cid('customer-hospitality'),'Room 1','Checkout Client',1,pg_temp.cid('stay-request'));
insert into hospitality_stay_bills(organization_id,branch_id,stay_id,invoice_id)
select pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),pg_temp.cid('stay'),bill from ctx where name='hospitality';
insert into organization_staff_profiles(id,organization_id,full_name)
select pg_temp.cid('staff-'||v),pg_temp.cid(v),'Staff '||v from unnest(array['salon','pet_care','automotive','hospitality','other'])v;
insert into organization_staff_profiles(id,organization_id,full_name) values(pg_temp.cid('second-staff'),pg_temp.cid('salon'),'Second stylist');
insert into appointment_staff_assignments(organization_id,appointment_id,staff_profile_id)
select pg_temp.cid(v),pg_temp.cid('appointment-'||v),pg_temp.cid('staff-'||v) from unnest(array['salon','pet_care'])v;
insert into appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values(pg_temp.cid('salon'),pg_temp.cid('appointment-salon'),pg_temp.cid('second-staff'));
update organization_staff_profiles set is_active=false where id=pg_temp.cid('second-staff');
update job_orders set primary_technician_staff_id=pg_temp.cid('staff-automotive') where id=pg_temp.cid('job');
update job_order_items set technician_staff_id=pg_temp.cid('staff-automotive') where job_order_id=pg_temp.cid('job');
insert into hospitality_stay_staff_events(organization_id,branch_id,stay_id,phase,cashier_staff_id,housekeeper_staff_id,cashier_name,housekeeper_name,recorded_by)
values(pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),pg_temp.cid('stay'),'check_in',pg_temp.cid('staff-hospitality'),pg_temp.cid('staff-hospitality'),'Recorded host','Recorded host',pg_temp.cid('owner'));
set local role authenticated;
insert into ctx(name,id) select v,open_checkout(pg_temp.cid('branch-'||v),pg_temp.cid('appointment-'||v),null,null,pg_temp.cid('open-'||v)) from unnest(array['salon','pet_care'])v;
update ctx set id=open_checkout(pg_temp.cid('branch-'||name),null,bill,null,pg_temp.cid('open-'||name)) where bill is not null;
update ctx set line=save_checkout_product(id,null,null,pg_temp.cid('item-'||name),2,pg_temp.cid('product-'||name));
select finalize_checkout(id,pg_temp.cid('finalize-'||name)) from ctx;
select record_checkout_payment(id,12000,'cash',null,current_date,pg_temp.cid('pay-'||name)) from ctx;
create function pg_temp.report(v text,client text default '',item text default '',kind text default 'all',page integer default 1) returns jsonb language sql as $$
 select public.get_client_purchase_report(pg_temp.cid(v),current_date-1,current_date+1,null,client,item,kind,page)
$$;
select is((get_catalog_financial_report(pg_temp.cid('hospitality'),current_date-1,current_date+1,pg_temp.cid('branch-hospitality'),'rooms')->'summary'->>'amount')::bigint,10000::bigint,'room totals count base stay bill once and exclude separate retail');
select is((get_catalog_financial_report(pg_temp.cid('hospitality'),current_date-1,current_date+1,pg_temp.cid('branch-hospitality'),'rooms')->'summary'->>'revenue')::bigint,10000::bigint,'room revenue is paid to date on stay bill');
select ok((get_hospitality_workspace(pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),current_date-1,current_date+1,'stays',1,'report')->'rows'->0) ?& array['charges','paid','balance'],'stay table includes money fields');
select is((get_hospitality_workspace(pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),current_date-1,current_date+1,'stays',1,'report')->'reportTotals'->>'amount')::bigint,15000::bigint,'hospitality summary includes posted retail and stay charges');
select throws_ok($$select get_catalog_financial_report(pg_temp.cid('salon'),current_date,current_date,pg_temp.cid('branch-salon'),'rooms')$$,'42501',null,'room report restricted to hospitality');
select throws_ok($$select get_catalog_financial_report(pg_temp.cid('salon'),current_date,current_date,pg_temp.cid('branch-other'),'promos')$$,'42501',null,'promo report rejects foreign branch');
select ok(not (get_hospitality_workspace(pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),current_date-365,current_date,'stays',1,'overview') ? 'reportTotals'),'overview cannot expose new arbitrary-range financial totals');
create function pg_temp.salon() returns jsonb language sql as $$
 select get_appointment_report(pg_temp.cid('salon'),current_date-1,current_date+1,pg_temp.cid('branch-salon'))
$$;
create function pg_temp.vertical_bookings(v text) returns jsonb language sql as $$
 select (case when v='automotive' then get_owner_report(pg_temp.cid(v),current_date-1,current_date+1,pg_temp.cid('branch-'||v)) else get_appointment_report(pg_temp.cid(v),current_date-1,current_date+1,pg_temp.cid('branch-'||v)) end)->'bookingDetails'
$$;
select is(pg_temp.vertical_bookings(v)->>'industry',v,v||': detail contract identifies vertical') from unnest(array['automotive','pet_care']) v;
select is(pg_temp.vertical_bookings(v)->'appointments'->0->>'client','Checkout Client',v||': booking shows customer/owner') from unnest(array['automotive','pet_care']) v;
select is(pg_temp.vertical_bookings(v)->'appointments'->0->>'staff','Staff '||v,v||': staff attribution is deduplicated') from unnest(array['automotive','pet_care']) v;
select ok((pg_temp.vertical_bookings(v)->'appointments'->0->>'products') like '%Retail bottle%',v||': purchased products follow visit checkout') from unnest(array['automotive','pet_care']) v;
select is((pg_temp.vertical_bookings(v)->'appointments'->0->>'total')::bigint,15000::bigint,v||': total uses canonical base and retail charges once') from unnest(array['automotive','pet_care']) v;
select throws_ok($$select booking_report_details_data(pg_temp.cid('automotive'),current_date,current_date,pg_temp.cid('branch-automotive'))$$,'42501',null,'private detail helper cannot bypass public scope checks');
select throws_ok($$select get_owner_report(pg_temp.cid('automotive'),current_date,current_date,pg_temp.cid('branch-other'))$$,'42501',null,'automotive detail reader denies foreign branch');
select throws_ok($$select get_appointment_report(pg_temp.cid('pet_care'),current_date,current_date,pg_temp.cid('branch-other'))$$,'42501',null,'pet detail reader denies foreign branch');
select is(pg_temp.salon()->'salonDetails'->'appointments'->0->>'client','Checkout Client','salon appointment shows client');
select is(pg_temp.salon()->'salonDetails'->'appointments'->0->>'staff','Second stylist, Staff salon','salon appointment retains multiple and inactive staff');
select ok((pg_temp.salon()->'salonDetails'->'appointments'->0->>'products') like '%Retail bottle%', 'salon appointment shows posted products');
select is((pg_temp.salon()->'salonDetails'->'appointments'->0->>'total')::bigint,15000::bigint,'salon visit total adds product bill exactly once despite multiple staff');
select is((pg_temp.salon()->'summary'->>'grossSalesCentavos')::bigint,15000::bigint,'salon sales total uses canonical charges');
select is((pg_temp.salon()->'summary'->>'paymentsReceivedCentavos')::bigint,12000::bigint,'salon collected revenue uses actual receipts');
select ok(jsonb_array_length(pg_temp.salon()->'salonDetails'->'payments')>0,'salon payment records present');
select is((pg_temp.report(name)->>'count')::integer,1,name||': base and retail bills merge by client ID') from ctx;
select is((pg_temp.report(name)->'summary'->>'total')::bigint,15000::bigint,name||': full bills counted exactly once') from ctx;
select is((pg_temp.report(name)->'summary'->>'paid')::bigint,12000::bigint,name||': current payments reconcile') from ctx;
select is((pg_temp.report(name)->'summary'->>'balance')::bigint,3000::bigint,name||': remaining balance reconciles') from ctx;
select is((pg_temp.report(name)->'rows'->0->>'clientId')::uuid,pg_temp.cid('customer-'||name),name||': correct client identity including invoice/guest adapters') from ctx;
select is(jsonb_array_length(pg_temp.report(name)->'rows'->0->'staff'),case when name='salon' then 2 else 1 end,name||': assigned staff deduplicated across base and product bills') from ctx;
select ok((pg_temp.report(name,'','bottle','product')->'rows'->0->'staff') @> jsonb_build_array(jsonb_build_object('id',pg_temp.cid('staff-'||name))),name||': product-only filter retains staff from its source visit/job/stay') from ctx;
select ok((pg_temp.report('salon')->'rows'->0->'staff') @> jsonb_build_array(jsonb_build_object('id',pg_temp.cid('second-staff'),'name','Second stylist')),'inactive staff without login retain historical attribution');
select is(pg_temp.report('hospitality')->'rows'->0->'staff'->0->>'name','Recorded host','hospitality uses recorded name snapshot');
select ok(not ((pg_temp.report('salon')->'rows'->0->'staff') @> jsonb_build_array(jsonb_build_object('id',pg_temp.cid('staff-other')))),'foreign tenant staff excluded');
select is((pg_temp.report(name,'','bottle','product')->'summary'->>'total')::bigint,5000::bigint,name||': item search selects product bill only') from ctx;
select is((pg_temp.report(name,'checkout client')->>'count')::integer,1,name||': case-insensitive client search') from ctx;
select is((pg_temp.report(name,'No such client')->>'count')::integer,0,name||': empty result') from ctx;
select is((pg_temp.report('salon','','Existing','service')->'summary'->>'total')::bigint,10000::bigint,'service filter excludes product-only bills');
select is(jsonb_array_length(pg_temp.report('salon')->'rows'->0->'items'),2,'services and products listed once');
select is((pg_temp.report('salon','','%')->>'count')::integer,0,'search is literal, not a wildcard');
select is(jsonb_array_length(pg_temp.report('salon','','','all',2)->'rows'),0,'pagination does not repeat first-page rows');
select is((pg_temp.report('salon','','','all',2)->'summary'->>'total')::bigint,15000::bigint,'pagination preserves totals across the full result');

reset role;
-- Same-name clients remain distinct, including visits in another branch.
insert into customers(id,organization_id,full_name) values(pg_temp.cid('second-client'),pg_temp.cid('salon'),'Checkout Client');
insert into appointments(id,organization_id,branch_id,customer_id,status,starts_at,expected_duration_minutes)
values(pg_temp.cid('second-visit'),pg_temp.cid('salon'),pg_temp.cid('second-branch'),pg_temp.cid('second-client'),'completed',now(),30),
(pg_temp.cid('cancelled-visit'),pg_temp.cid('salon'),pg_temp.cid('branch-salon'),pg_temp.cid('customer-salon'),'cancelled',now(),30);
insert into appointment_services(appointment_id,service_id) values(pg_temp.cid('second-visit'),pg_temp.cid('service-salon')),(pg_temp.cid('cancelled-visit'),pg_temp.cid('service-salon'));
insert into organization_staff_profiles(id,organization_id,full_name) values(pg_temp.cid('branch-staff'),pg_temp.cid('salon'),'Other branch stylist');
insert into appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values(pg_temp.cid('salon'),pg_temp.cid('second-visit'),pg_temp.cid('branch-staff'));
-- Included products are fulfilled but carry no extra revenue.
insert into checkout_lines(checkout_id,inventory_item_id,name,unit,quantity,unit_price_centavos,included_key,stock_tracked,handed_over)
select id,pg_temp.cid('item-salon'),'Promo sample','piece',1,0,'report-promo',false,1 from ctx where name='salon';
select is((select (r->>'total')::bigint from jsonb_array_elements(pg_temp.salon()->'salonDetails'->'appointments') r where r->>'id'=pg_temp.cid('appointment-salon')::text),15000::bigint,'promo inclusions do not increase appointment total');
select ok((select r->>'products' like '%Promo sample%included%' from jsonb_array_elements(pg_temp.salon()->'salonDetails'->'appointments') r where r->>'id'=pg_temp.cid('appointment-salon')::text),'fulfilled promo products are labelled included');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.salon()->'salonDetails'->'appointments') r where r->>'id'=pg_temp.cid('second-visit')::text),'salon details exclude other branches');
-- Reuse a non-reporting identity as a branch-restricted viewer for isolation tests.
delete from organization_memberships where id=pg_temp.cid('tech-member');
insert into organization_memberships(id,organization_id,user_id,role) values(pg_temp.cid('viewer-member'),pg_temp.cid('salon'),pg_temp.cid('technician'),'viewer');
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values(pg_temp.cid('salon'),pg_temp.cid('viewer-member'),pg_temp.cid('branch-salon'));
-- A UTC evening belongs to the following calendar day at a Manila branch.
update branches set timezone='Asia/Manila' where id=pg_temp.cid('branch-salon');
insert into appointments(id,organization_id,branch_id,customer_id,status,starts_at,expected_duration_minutes)
values(pg_temp.cid('dated-visit'),pg_temp.cid('salon'),pg_temp.cid('branch-salon'),pg_temp.cid('customer-salon'),'completed','2001-01-01 16:30Z',30);
insert into appointment_services(appointment_id,service_id) values(pg_temp.cid('dated-visit'),pg_temp.cid('service-salon'));
-- Unlinked bills must never be merged solely because their names match.
insert into invoices(id,organization_id,branch_id,billing_kind,invoice_number,status,customer_name_snapshot,subtotal_centavos,discount_centavos,total_centavos,balance_centavos,issued_at)
select pg_temp.cid('unlinked-'||n),pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),'manual','UNLINKED-'||n,'issued','Same walk-in name',100,10,90,90,now() from generate_series(1,51)n;
insert into invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos)
select pg_temp.cid('unlinked-'||n),pg_temp.cid('hospitality'),'Charge '||x,1,50,50 from generate_series(1,51)n cross join generate_series(1,2)x;
insert into invoices(organization_id,branch_id,billing_kind,invoice_number,status,customer_name_snapshot,subtotal_centavos,total_centavos,balance_centavos,issued_at)
select pg_temp.cid('hospitality'),pg_temp.cid('branch-hospitality'),'manual','EXCLUDED-'||s,s::invoice_status,'Excluded',10000,10000,10000,now() from unnest(array['draft','void'])s;
set local role authenticated;
select is((get_client_purchase_report(pg_temp.cid('salon'),'2001-01-02','2001-01-02')->'summary'->>'total')::bigint,10000::bigint,'visit date uses branch timezone');
select is((get_client_purchase_report(pg_temp.cid('salon'),'2001-01-01','2001-01-01')->'summary'->>'total')::bigint,0::bigint,'previous UTC calendar day excluded');
select is((pg_temp.report('hospitality')->>'count')::integer,52,'unlinked same-name bills remain separate');
select is(jsonb_array_length(pg_temp.report('hospitality','Same walk-in name')->'rows'->0->'staff'),0,'unlinked bills never infer staff from customer name or author');
select is(jsonb_array_length(pg_temp.report('hospitality')->'rows'),50,'page size bounded to 50');
select is(jsonb_array_length(pg_temp.report('hospitality','','','all',2)->'rows'),2,'second page contains remaining records');
select is((pg_temp.report('hospitality')->'summary'->>'total')::bigint,19590::bigint,'header discounts respected, multiple items never multiply totals, draft and void excluded');
select is((pg_temp.report('hospitality','','','all',2)->'summary'->>'total')::bigint,19590::bigint,'full result total stable on second page');
select is((pg_temp.report('salon')->>'count')::integer,2,'same-name customers remain separate');
select is((pg_temp.report('salon')->'summary'->>'total')::bigint,25000::bigint,'cancelled visits excluded and promo inclusions add no revenue');
select is((pg_temp.report('salon','','Promo sample','product')->'summary'->>'total')::bigint,10000::bigint,'included product filter returns its containing appointment once');
select throws_ok($$select get_client_purchase_report(pg_temp.cid('other'),current_date,current_date)$$,'42501','Reporting access required','cross-tenant denied');
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date,pg_temp.cid('branch-other'))$$,'42501','Branch not found','foreign branch denied');
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date-1)$$,'22023','Invalid reporting range','inverted dates denied');
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date,null,'','', 'invalid')$$,'22023','Invalid report filters','invalid purchase kind denied');
select throws_ok($$select pg_temp.report('salon','','','all',0)$$,'22023','Invalid report filters','invalid page denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid('technician'),'role','authenticated')::text,true);
select is((pg_temp.report('salon')->'summary'->>'total')::bigint,15000::bigint,'viewer all-branches scope excludes unassigned branch');
select ok(not ((pg_temp.report('salon')->'rows'->0->'staff') @> jsonb_build_array(jsonb_build_object('id',pg_temp.cid('branch-staff')))),'staff from inaccessible branch excluded');
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date,pg_temp.cid('second-branch'))$$,'42501','Branch not found','explicit unassigned branch denied');
reset role;
update organizations set financial_report_roles_only=true where id=pg_temp.cid('salon');
set local role authenticated;
select throws_ok($$select pg_temp.report('salon')$$,'42501','Financial reporting access required','financial role policy remains authoritative');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid('cashier'),'role','authenticated')::text,true);
select throws_ok($$select pg_temp.report('salon')$$,'42501','Reporting access required','cashier cannot call reporting RPC');
reset role;
update organization_subscriptions set plan_id='free',status='free' where organization_id=pg_temp.cid('salon');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid('owner'),'role','authenticated')::text,true);
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date,pg_temp.cid('branch-salon'))$$,'42501','Advanced reports require an eligible plan','free plan cannot bypass detailed report access');
set local role anon;
select throws_ok($$select get_client_purchase_report(pg_temp.cid('salon'),current_date,current_date)$$,'42501',null,'anonymous access denied');
select * from finish();
rollback;
