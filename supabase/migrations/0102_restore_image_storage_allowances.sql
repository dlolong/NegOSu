begin;

-- Some hosted installations restored billing functions without the storage
-- allowances from 0028. Apply after 0101; preserve explicit/custom limits.
update public.plans
set limits = limits || jsonb_build_object('storage_mb', case id
  when 'free' then 100
  when 'starter' then 1000
  when 'business' then 5000
  when 'pro' then 20000
  when 'multi_branch' then -1
end)
where id in ('free', 'starter', 'business', 'pro', 'multi_branch')
  and (not (limits ? 'storage_mb') or limits->'storage_mb' = 'null'::jsonb);

notify pgrst, 'reload schema';
commit;
