-- Preserve authoritative currency in customer-facing projections and new appointment payments.
-- No historical amounts or RLS policies change. Anonymous payment execution is revoked.

begin;
CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('slug',o.slug,'currency',o.currency,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone,'description',b.public_description,'phone',b.phone,'email',b.email,'address',array[b.address_line,b.barangay,b.city,b.province,b.postal_code,b.country],'mapUrl',b.map_url,'hours',b.opening_hours,'acceptsBookings',b.accepts_public_bookings) order by b.is_primary desc,b.name) from public.branches b where b.organization_id=o.id and b.is_active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'currency',s.currency,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'priceCentavos',s.base_price_centavos,'category',c.name) order by c.sort_order,s.name) from public.services s left join public.service_categories c on c.id=s.category_id and c.organization_id=o.id where s.organization_id=o.id and s.is_active and s.is_public),'[]'::jsonb),
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt_text) order by g.sort_order,g.created_at) from public.shop_gallery_images g where g.organization_id=o.id and g.is_active),'[]'::jsonb))
 from public.organizations o where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled
$function$;

CREATE OR REPLACE FUNCTION public.get_public_appointment_self_service(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select case when link.status<>'active' then jsonb_build_object('state',link.status)
    when link.expires_at<=now() then jsonb_build_object('state','expired')
    when appointment.status in('cancelled','no_show') then jsonb_build_object('state','unavailable')
    else jsonb_build_object(
      'state','active','scheduleRevision',link.schedule_revision,'petName',(select pet_name_snapshot from public.pet_appointment_details where appointment_id=appointment.id),'businessName',organization.name,'currency',organization.currency,'logoUrl',organization.logo_url,'branchName',branch.name,'branchTimezone',branch.timezone,
      'appointmentStatus',appointment.status,'startsAt',appointment.starts_at,'endsAt',appointment.ends_at,
      'treatments',(select coalesce(jsonb_agg(jsonb_build_object('name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=appointment.id),
      'assignedStaff',(select coalesce(jsonb_agg(case when organization.industry='salon' then coalesce(profile.full_name,staff.full_name) else staff.full_name end order by staff.full_name),'[]'::jsonb) from public.appointment_staff_assignments assignment join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id and staff.organization_id=appointment.organization_id left join public.organization_memberships member on member.id=staff.membership_id and member.organization_id=appointment.organization_id left join public.profiles profile on profile.id=member.user_id where assignment.appointment_id=appointment.id),
      'paymentStatus',case when coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)>=appointment.expected_total_centavos then 'paid' when exists(select 1 from public.payments p where p.appointment_id=appointment.id and p.status='paid') then 'partial' else 'unpaid' end,
      'totalCentavos',appointment.expected_total_centavos,
      'paidCentavos',coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)
    ) end into result
  from public.appointment_self_service_links link
  join public.appointments appointment on appointment.id=link.appointment_id
  join public.organizations organization on organization.id=link.organization_id and organization.industry in('salon','pet_care') and organization.status='active'
  join public.branches branch on branch.id=link.branch_id
  where link.token_hash=p_token_hash;
  return coalesce(result,jsonb_build_object('state','invalid'));
end $function$;

CREATE OR REPLACE FUNCTION public.get_public_estimate_approval(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'business',(select jsonb_build_object('name',organization.name,'currency',organization.currency,'phone',organization.phone,'logoUrl',organization.logo_url) from public.organizations organization where organization.id=link_row.organization_id),
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
end $function$;


CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_amount_centavos bigint, p_method payment_method, p_idempotency_key text, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare appointment_row public.appointments; existing_payment public.payments; paid bigint; payment_id uuid; operation_key text:=nullif(trim(coalesce(p_idempotency_key,'')),''); normalized_reference text:=nullif(trim(coalesce(p_reference,'')),''); normalized_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry in('salon','pet_care') and organization.status='active' where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  if operation_key is null or char_length(operation_key) not between 8 and 200 then raise exception 'Invalid idempotency key'; end if;
  select * into existing_payment from public.payments where organization_id=appointment_row.organization_id and appointment_idempotency_key=operation_key and appointment_id is not null;
  if existing_payment.id is not null then
    if existing_payment.appointment_id=appointment_row.id and existing_payment.amount_centavos=p_amount_centavos and existing_payment.method=p_method
      and existing_payment.reference is not distinct from normalized_reference and existing_payment.notes is not distinct from normalized_notes
    then return existing_payment.id; end if;
    raise exception 'Idempotency key conflicts with an existing payment';
  end if;
  select coalesce(sum(amount_centavos),0) into paid from public.payments where appointment_id=appointment_row.id and status='paid';
  if p_amount_centavos<=0 or p_amount_centavos>appointment_row.expected_total_centavos-paid then raise exception 'Invalid payment amount'; end if;
  insert into public.payments(organization_id,branch_id,appointment_id,amount_centavos,currency,method,status,reference,paid_at,notes,received_by,created_by,appointment_idempotency_key)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_amount_centavos,(select currency from public.organizations where id=appointment_row.organization_id),p_method,'paid',normalized_reference,now(),normalized_notes,auth.uid(),auth.uid(),operation_key)
  returning id into payment_id;
  return payment_id;
end $function$;


-- Payment writes are an authenticated API; do not inherit PUBLIC execution.
revoke all on function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text,text) from public, anon;
grant execute on function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text,text) to authenticated;

commit;
