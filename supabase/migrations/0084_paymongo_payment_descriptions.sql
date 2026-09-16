-- Snapshot checkout labels so business renames cannot change an idempotent retry.
-- Existing orders stay null and continue using their original provider payload.
alter table public.billing_orders add column payment_description text;

create function public.set_billing_order_description()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare business_name text;
begin
 if tg_op='UPDATE' then
  new.payment_description:=old.payment_description;
  return new;
 end if;
 select left(trim(regexp_replace(name,'[[:cntrl:][:space:]|]+',' ','g')),60)
 into business_name from public.organizations where id=new.organization_id;
 new.payment_description:=concat(
  case when new.livemode then '' else 'TEST | ' end,
  'NegOSu | ',coalesce(nullif(business_name,''),'Workspace'),
  ' | ',left(trim(regexp_replace(new.plan_name,'[[:cntrl:][:space:]|]+',' ','g')),30),
  ' | ',case when new.billing_interval='year' then 'Yearly' else 'Monthly' end,
  ' | ',case new.kind when 'renewal' then 'Renewal' when 'upgrade' then 'Upgrade' else 'New plan' end,
  ' | Ref: ',new.id::text
 );
 return new;
end $$;
revoke all on function public.set_billing_order_description() from public,anon,authenticated;
create trigger billing_orders_description
 before insert or update of payment_description on public.billing_orders
 for each row execute function public.set_billing_order_description();

notify pgrst,'reload schema';
