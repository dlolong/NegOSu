-- Preserve walk-in origin when the shared appointment enters the automotive queue.
-- Keep the existing row lock, transactional counter, and service snapshots.
create or replace function public.enqueue_appointment(p_appointment_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; branch_tz text; operational_date date; next_number integer; queue_id uuid;
begin
  select * into appointment_row from public.appointments where id=p_appointment_id for update;
  select timezone into branch_tz from public.branches where id=appointment_row.branch_id;
  if appointment_row.id is null or auth.uid() is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id) then raise exception 'Appointment not found' using errcode='42501'; end if;
  if appointment_row.vehicle_id is null then raise exception 'A vehicle is required to enter the automotive queue'; end if;
  if appointment_row.status not in ('checked_in','confirmed') then raise exception 'Appointment must be confirmed or arrived'; end if;
  operational_date:=(now() at time zone branch_tz)::date;
  insert into public.queue_counters(branch_id,queue_date,last_number) values(appointment_row.branch_id,operational_date,1)
    on conflict(branch_id,queue_date) do update set last_number=public.queue_counters.last_number+1 returning last_number into next_number;
  insert into public.queue_entries(organization_id,branch_id,appointment_id,customer_id,vehicle_id,source,queue_date,queue_number,estimated_total_centavos,estimated_duration_minutes,created_by)
    values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,appointment_row.customer_id,appointment_row.vehicle_id,case when appointment_row.source='walk_in' then 'walk_in' else 'appointment' end,operational_date,next_number,appointment_row.expected_total_centavos,appointment_row.expected_duration_minutes,auth.uid()) returning id into queue_id;
  update public.appointments set status='queued' where id=appointment_row.id;
  return queue_id;
end $$;

revoke all on function public.enqueue_appointment(uuid) from public,anon;
grant execute on function public.enqueue_appointment(uuid) to authenticated;
