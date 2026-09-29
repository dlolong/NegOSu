begin;
update public.plans set features=features||jsonb_build_object('image_uploads',id in('starter','business','pro','multi_branch'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-images','business-images',true,2097152,array['image/jpeg','image/png','image/webp']);

-- Storage checks permissions before upload, then finalizes as a privileged role.
-- RLS controls who may upload; the trigger enforces quota at final persistence too.
create function public.can_upload_business_image(p_name text,p_metadata jsonb) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
 if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$' then return false; end if;
 begin org:=split_part(p_name,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 return public.has_org_role(org,array['owner','manager']::public.organization_role[])
   and coalesce((public.effective_entitlements(org)->'features'->>'image_uploads')::boolean,false);
end $$;
revoke all on function public.can_upload_business_image(text,jsonb) from public,anon;
grant execute on function public.can_upload_business_image(text,jsonb) to authenticated;

create function public.enforce_business_image_quota() returns trigger
language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare org uuid; ent jsonb; quota bigint; used bigint; incoming bigint;
begin
 if new.bucket_id<>'business-images' then return new; end if;
 org:=split_part(new.name,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended('business-images:'||org::text,0));
 ent:=public.effective_entitlements(org);
 if coalesce((ent->'features'->>'image_uploads')::boolean,false) is not true then
   raise exception 'Image uploads require an eligible plan' using errcode='42501';
 end if;
 quota:=(ent->'limits'->>'storage_mb')::bigint;
 -- Preflight may omit size. Reserve headroom for the maximum file in that check;
 -- final persistence uses actual backend size, independent of client declarations.
 incoming:=coalesce((new.metadata->>'size')::bigint,(new.metadata->>'contentLength')::bigint,2097152);
 if quota is null or incoming<1 or incoming>2097152 then raise exception 'Invalid image size or storage allowance' using errcode='23514'; end if;
 select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into used
 from storage.objects where bucket_id='business-images' and split_part(name,'/',1)=org::text and name<>new.name;
 if quota<>-1 and used+incoming>quota*1048576 then raise exception 'Image storage limit reached' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.enforce_business_image_quota() from public,anon,authenticated;
create trigger business_image_quota before insert or update on storage.objects
for each row execute function public.enforce_business_image_quota();
create policy business_images_insert on storage.objects for insert to authenticated
with check(bucket_id='business-images' and public.can_upload_business_image(name,metadata));
create policy business_images_read on storage.objects for select to authenticated
using(bucket_id='business-images' and exists(select 1 from public.organizations o where o.id::text=split_part(name,'/',1) and public.has_org_role(o.id,array['owner','manager']::public.organization_role[])));
create policy business_images_delete on storage.objects for delete to authenticated
using(bucket_id='business-images' and exists(select 1 from public.organizations o where o.id::text=split_part(name,'/',1) and public.has_org_role(o.id,array['owner','manager']::public.organization_role[])));
-- No UPDATE policy: callers cannot overwrite another image or bypass insert quota.
notify pgrst,'reload schema';
commit;
