-- Business branding uses the existing organizations.logo_url column.
-- Extend existing public projections only; preserve token, publication, and tenant checks.
-- No table grants, RLS policies, or stored customer data are changed.
begin;

create or replace function public.get_public_booking_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path=public,extensions,pg_temp
as $$
  select jsonb_build_object(
    'reference',r.public_reference,
    'status',r.status,
    'industry',o.industry,
    'timezone',b.timezone,
    'shopName',o.name,
    'logoUrl',o.logo_url,
    'shopSlug',o.slug,
    'branchName',b.name,
    'preferredAt',r.preferred_at,
    'scheduledAt',coalesce(a.starts_at,r.preferred_at),
    'appointmentStatus',case when r.status='confirmed' then a.status::text end,
    'updatedAt',greatest(r.updated_at,coalesce(a.updated_at,r.updated_at)),
    'services',(select jsonb_agg(s.service_name_snapshot order by s.service_name_snapshot) from public.public_booking_services s where s.booking_request_id=r.id),
    'declineReason',case when r.status='declined' then r.decline_reason end
  )
  from public.public_booking_requests r
  join public.organizations o on o.id=r.organization_id
  join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
  left join public.appointments a on a.id=r.appointment_id and a.organization_id=r.organization_id
  where r.confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
$$;

revoke all on function public.get_public_booking_status(text) from public;
grant execute on function public.get_public_booking_status(text) to anon,authenticated;

create or replace function public.get_public_estimate_approval(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  link_row public.estimate_approval_links;
  estimate_row public.estimates;
  payload jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select * into link_row from public.estimate_approval_links where token_hash=p_token_hash;
  if link_row.id is null then return jsonb_build_object('state','invalid'); end if;
  if link_row.status='revoked' then return jsonb_build_object('state','revoked'); end if;
  if link_row.status='superseded' then return jsonb_build_object('state','superseded'); end if;
  if link_row.status='expired' or link_row.expires_at<=now() then return jsonb_build_object('state','expired'); end if;

  select * into estimate_row from public.estimates where id=link_row.estimate_id;
  if estimate_row.id is null
    or estimate_row.version<>link_row.estimate_version
    or estimate_row.total_centavos<>link_row.estimate_total_centavos
    or exists(select 1 from public.estimates newer where newer.job_order_id=link_row.job_order_id and newer.version>link_row.estimate_version)
    or (link_row.status='active' and estimate_row.status not in ('draft','sent'))
  then return jsonb_build_object('state','superseded'); end if;

  select jsonb_build_object(
    'state',link_row.status,
    'expiresAt',link_row.expires_at,
    'decidedAt',link_row.used_at,
    'estimate',jsonb_build_object(
      'version',link_row.estimate_version,
      'subtotalCentavos',estimate_row.subtotal_centavos,
      'discountCentavos',estimate_row.discount_centavos,
      'taxCentavos',estimate_row.tax_centavos,
      'totalCentavos',estimate_row.total_centavos,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'description',item.description_snapshot,
          'quantity',item.quantity,
          'unitPriceCentavos',item.unit_price_centavos,
          'discountCentavos',item.discount_centavos,
          'lineTotalCentavos',item.line_total_centavos
        ) order by item.id)
        from public.estimate_items item where item.estimate_id=estimate_row.id
      ),'[]'::jsonb)
    ),
    'business',(select jsonb_build_object('name',organization.name,'phone',organization.phone,'logoUrl',organization.logo_url) from public.organizations organization where organization.id=link_row.organization_id),
    'branch',(select jsonb_build_object(
      'name',branch.name,'phone',branch.phone,'email',branch.email,
      'address',jsonb_build_array(branch.address_line,branch.city,branch.province)
    ) from public.branches branch where branch.id=link_row.branch_id),
    'job',(select jsonb_build_object(
      'reference',case when job.job_number is null then 'Job order' else 'JO-'||extract(year from job.created_at)::integer||'-'||lpad(job.job_number::text,6,'0') end,
      'vehicle',(select jsonb_build_object('make',vehicle.make,'model',vehicle.model,'modelYear',vehicle.model_year,'plateNumber',vehicle.plate_number) from public.vehicles vehicle where vehicle.id=job.vehicle_id)
    ) from public.job_orders job where job.id=link_row.job_order_id)
  ) into payload;
  return payload;
end $$;

revoke all on function public.get_public_estimate_approval(text) from public;
grant execute on function public.get_public_estimate_approval(text) to anon,authenticated;

create or replace function public.get_public_appointment_self_service(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select case when link.status<>'active' then jsonb_build_object('state',link.status)
    when link.expires_at<=now() then jsonb_build_object('state','expired')
    when appointment.status in('cancelled','no_show') then jsonb_build_object('state','unavailable')
    else jsonb_build_object(
      'state','active','businessName',organization.name,'logoUrl',organization.logo_url,'branchName',branch.name,'branchTimezone',branch.timezone,
      'appointmentStatus',appointment.status,'startsAt',appointment.starts_at,'endsAt',appointment.ends_at,
      'treatments',(select coalesce(jsonb_agg(jsonb_build_object('name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=appointment.id),
      'assignedStaff',(select coalesce(jsonb_agg(coalesce(nullif(trim(profile.full_name),''),'Salon staff') order by coalesce(nullif(trim(profile.full_name),''),'Salon staff')),'[]'::jsonb)
        from public.appointment_staff_assignments assignment
        join public.organization_memberships membership on membership.id=assignment.staff_membership_id and membership.organization_id=appointment.organization_id
        left join public.profiles profile on profile.id=membership.user_id
        where assignment.appointment_id=appointment.id),
      'paymentStatus',case when coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)>=appointment.expected_total_centavos then 'paid' when exists(select 1 from public.payments p where p.appointment_id=appointment.id and p.status='paid') then 'partial' else 'unpaid' end,
      'totalCentavos',appointment.expected_total_centavos,
      'paidCentavos',coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)
    ) end into result
  from public.appointment_self_service_links link
  join public.appointments appointment on appointment.id=link.appointment_id
  join public.organizations organization on organization.id=link.organization_id and organization.industry='salon'
  join public.branches branch on branch.id=link.branch_id
  where link.token_hash=p_token_hash;
  return coalesce(result,jsonb_build_object('state','invalid'));
end $$;

revoke all on function public.get_public_appointment_self_service(text) from public;
grant execute on function public.get_public_appointment_self_service(text) to anon,authenticated;

create or replace function public.get_public_salon_queue(p_slug text, p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare business record; local_day date; result jsonb;
begin
  select o.id as organization_id,o.name as organization_name,o.logo_url,b.name as branch_name,b.timezone
    into business
  from public.organizations o join public.branches b on b.organization_id=o.id
  where o.slug=lower(trim(p_slug)) and o.industry='salon'
    and o.status='active' and o.public_page_enabled
    and b.id=p_branch_id and b.is_active;
  if not found then return null; end if;
  local_day:=(now() at time zone business.timezone)::date;
  with queue as (
    select a.id,a.starts_at,a.status,
      regexp_split_to_array(trim(coalesce(c.full_name,'')), '\s+') as name_parts
    from public.appointments a
    join public.customers c on c.id=a.customer_id and c.organization_id=a.organization_id
    where a.organization_id=business.organization_id and a.branch_id=p_branch_id
      and a.status in('checked_in','in_service')
      and a.starts_at >= (local_day::timestamp at time zone business.timezone)
      and a.starts_at < ((local_day+1)::timestamp at time zone business.timezone)
  ), items as (
    select id,starts_at,status,jsonb_build_object(
      'key',substr(encode(extensions.digest(id::text||local_day::text,'sha256'),'hex'),1,16),
      'label',case when coalesce(name_parts[1],'')='' then 'Guest'
        else left(name_parts[1],24)||case when cardinality(name_parts)>1
          then ' '||left(name_parts[cardinality(name_parts)],1)||'.' else '' end end,
      'detail','Appointment '||to_char(starts_at at time zone business.timezone,'FMHH12:MI AM')
    ) as item from queue
  )
  select jsonb_build_object(
    'organizationName',business.organization_name,'logoUrl',business.logo_url,'branchName',business.branch_name,
    'industry','salon','date',local_day::text,'timezone',business.timezone,'refreshedAt',now(),
    'serving',coalesce(jsonb_agg(item order by starts_at,id) filter(where status='in_service'),'[]'::jsonb),
    'waiting',coalesce(jsonb_agg(item order by starts_at,id) filter(where status='checked_in'),'[]'::jsonb)
  ) into result from items;
  return result;
end $$;

revoke all on function public.get_public_salon_queue(text,uuid) from public;
grant execute on function public.get_public_salon_queue(text,uuid) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
