begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.sid(text) returns uuid language sql immutable as $$select md5('spam-guard-test-'||$1)::uuid$$;
insert into organizations(id,name,slug,industry) values(pg_temp.sid('org'),'Spam guard test','spam-guard-test','salon'),(pg_temp.sid('other'),'Other test','spam-guard-other','salon');
insert into branches(id,organization_id,name,is_primary) values(pg_temp.sid('branch'),pg_temp.sid('org'),'Main',true),(pg_temp.sid('other-branch'),pg_temp.sid('other'),'Main',true);
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos,product_purpose,is_public)
values(pg_temp.sid('product'),pg_temp.sid('org'),pg_temp.sid('branch'),'Product','piece',100,'retail',true);
-- Exercise the database guards directly; RPC access/validation is covered by
-- public_product_orders.sql and public booking suites.
create function pg_temp.booking(k text,slot_number int default 1,contact text default '09171234567',subject text default null,other_org boolean default false) returns void language sql as $$
 insert into public_booking_requests(id,organization_id,branch_id,public_reference,confirmation_token_hash,customer_name,phone,phone_normalized,preferred_at,duplicate_hash,rate_key_hash,subject_key)
 values(pg_temp.sid(k),pg_temp.sid(case when other_org then 'other' else 'org' end),pg_temp.sid(case when other_org then 'other-branch' else 'branch' end),k,md5(k),'Customer',contact,normalize_phone(contact),now()+interval '2 days'+slot_number*interval '1 hour',md5(k),md5(k),subject);
$$;
select lives_ok($$select pg_temp.booking('first')$$,'first booking is allowed');
select throws_ok($$select pg_temp.booking('duplicate',1,'+63 917 123 4567')$$,'P0409','A similar request is already pending','formatting and a new fingerprint do not bypass same-slot guard');
select lives_ok($$select pg_temp.booking('pet',1,'09171234567','second-pet:dog')$$,'different pet remains a distinct request');
select lives_ok($$select pg_temp.booking('slot3',3)$$,'different time is allowed within cap');
select lives_ok($$select pg_temp.booking('slot4',4)$$,'fourth booking is allowed');
select lives_ok($$insert into public_product_orders(id,organization_id,branch_id,product_id,product_name,unit,quantity,unit_price_centavos,currency,customer_name,phone,phone_normalized,request_payload)
 values(pg_temp.sid('order'),pg_temp.sid('org'),pg_temp.sid('branch'),pg_temp.sid('product'),'Product','piece',1,100,'PHP','Customer','09171234567',normalize_phone('09171234567'),'[]')$$,'product order shares the fifth allowance');
select throws_ok($$select pg_temp.booking('sixth',6)$$,'54000','Too many public requests','changing slot and fingerprint cannot bypass combined phone cap');
select lives_ok($$select pg_temp.booking('other-tenant',1,'09171234567',null,true)$$,'businesses have separate allowances');
select lives_ok($$select pg_temp.booking('another-customer',1,'09171234568')$$,'another customer has a separate allowance');
insert into public_booking_rate_limits(key_hash,window_started_at,request_count)
values('public-business:'||pg_temp.sid('org')::text,date_trunc('hour',now()),100)
on conflict(key_hash,window_started_at) do update set request_count=100;
select throws_ok($$select pg_temp.booking('org-cap',7,'09171234569')$$,'54000','Too many public requests','business cap protects against rotating contact numbers');
select ok(not has_function_privilege('anon','public.guard_public_request_insert()','execute'),'anonymous callers cannot invoke guard directly');
select ok(not has_table_privilege('anon','public.public_booking_rate_limits','insert'),'anonymous callers cannot change counters');
select * from finish();
rollback;
