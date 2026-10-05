-- Read-only operational attribution. Security-invoker views retain each source's
-- RLS and column grants; no public access or new write paths are introduced.
create view public.staff_work_participation with (security_invoker=true) as
select a.organization_id,a.branch_id,'appointment'::text kind,a.id record_id,a.id target_id,a.id appointment_id,
 ass.staff_profile_id staff_id,sp.full_name staff_name,null::uuid service_id,case when o.industry='automotive' then 'scheduled_staff' else 'visit_assignment' end source,
 a.status::text work_status,coalesce(a.starts_at,a.created_at) occurred_at,'Appointment time'::text time_label,
 coalesce((select string_agg(s.service_name_snapshot,', ' order by s.service_name_snapshot) from public.appointment_services s where s.appointment_id=a.id),'Appointment') work_label,
 coalesce(c.full_name,'Customer unavailable') customer_name
from public.appointments a
join public.organizations o on o.id=a.organization_id and o.industry in('salon','pet_care','automotive')
join public.appointment_staff_assignments ass on ass.appointment_id=a.id and ass.organization_id=a.organization_id
join public.organization_staff_profiles sp on sp.id=ass.staff_profile_id and sp.organization_id=a.organization_id
left join public.customers c on c.id=a.customer_id and c.organization_id=a.organization_id
where public.can_access_branch(a.organization_id,a.branch_id)
 and (o.industry<>'automotive' or not exists(select 1 from public.job_orders j where j.appointment_id=a.id and j.organization_id=a.organization_id and j.branch_id=a.branch_id))
union all
select j.organization_id,j.branch_id,'job',j.id,j.id,j.appointment_id,sp.id,coalesce(r.primary_technician_name_snapshot,sp.full_name),null::uuid,'job_assignment',
 j.status::text,coalesce(j.completed_at,j.created_at),case when j.completed_at is null then 'Recorded time' else 'Job completion' end,
 'Job #'||coalesce(j.job_number::text,'—')||coalesce((select ' · '||string_agg(i.service_name_snapshot,', ' order by i.service_name_snapshot) from public.job_order_items i where i.job_order_id=j.id and i.organization_id=j.organization_id and i.approval_status='approved'),''),coalesce(c.full_name,'Customer unavailable')
from public.job_orders j
left join public.vehicle_service_records r on r.source_job_order_id=j.id and r.organization_id=j.organization_id and r.branch_id=j.branch_id
join public.organization_staff_profiles sp on sp.id=case when r.id is not null then r.primary_technician_staff_id else j.primary_technician_staff_id end and sp.organization_id=j.organization_id
left join public.customers c on c.id=j.customer_id and c.organization_id=j.organization_id
where public.can_access_branch(j.organization_id,j.branch_id)
union all
select j.organization_id,j.branch_id,'job',j.id,j.id,j.appointment_id,sp.id,coalesce(ri.technician_name_snapshot,sp.full_name),i.service_id,'service_assignment',
 j.status::text,coalesce(j.completed_at,j.created_at),case when j.completed_at is null then 'Recorded time' else 'Job completion' end,i.service_name_snapshot,coalesce(c.full_name,'Customer unavailable')
from public.job_order_items i
join public.job_orders j on j.id=i.job_order_id and j.organization_id=i.organization_id
left join public.vehicle_service_records r on r.source_job_order_id=j.id and r.organization_id=j.organization_id and r.branch_id=j.branch_id
left join public.vehicle_service_record_items ri on ri.service_record_id=r.id and ri.source_job_order_item_id=i.id and ri.organization_id=j.organization_id
join public.organization_staff_profiles sp on sp.id=case when r.id is not null then ri.technician_staff_id else i.technician_staff_id end and sp.organization_id=j.organization_id
left join public.customers c on c.id=j.customer_id and c.organization_id=j.organization_id
where (r.id is null and i.approval_status='approved' or ri.id is not null) and public.can_access_branch(j.organization_id,j.branch_id)
union all
select j.organization_id,j.branch_id,'job',j.id,j.id,j.appointment_id,w.technician_staff_id,w.technician_name_snapshot,null::uuid,'work_session',
 j.status::text,coalesce(j.completed_at,j.created_at),case when j.completed_at is null then 'Recorded time' else 'Job completion' end,
 'Job #'||coalesce(j.job_number::text,'—')||coalesce((select ' · '||string_agg(i.service_name_snapshot,', ' order by i.service_name_snapshot) from public.job_order_items i where i.job_order_id=j.id and i.organization_id=j.organization_id and i.approval_status='approved'),''),coalesce(c.full_name,'Customer unavailable')
from public.automotive_job_order_work_sessions w
join public.job_orders j on j.id=w.job_order_id and j.organization_id=w.organization_id and j.branch_id=w.branch_id
left join public.customers c on c.id=j.customer_id and c.organization_id=j.organization_id
where w.status<>'cancelled' and public.can_access_branch(j.organization_id,j.branch_id)
union all
select e.organization_id,e.branch_id,'stay',e.id,e.stay_id,null::uuid,person.staff_id,person.name,null::uuid,person.source,
 'completed',e.recorded_at,'Recorded time',replace(e.phase,'_',' ')||' · '||s.room_name_snapshot,s.guest_name_snapshot
from public.hospitality_stay_staff_events e
join public.hospitality_stays s on s.id=e.stay_id and s.organization_id=e.organization_id and s.branch_id=e.branch_id
cross join lateral(values(e.cashier_staff_id,e.cashier_name,'cashier'),(e.housekeeper_staff_id,e.housekeeper_name,'housekeeper')) person(staff_id,name,source)
where public.can_access_branch(e.organization_id,e.branch_id);

-- Each employee gets one entry per completed visit/job or recorded stay event,
-- even when they hold several assignments or clock multiple work sessions.
create view public.staff_completed_work with (security_invoker=true) as
select organization_id,branch_id,kind,record_id,target_id,staff_id,
 max(staff_name) staff_name,max(customer_name) customer_name,max(occurred_at) occurred_at,max(time_label) time_label,
 string_agg(distinct work_label,', ' order by work_label) work_label,
 array_agg(distinct source order by source) sources
from public.staff_work_participation
where work_status='completed' and source<>'scheduled_staff'
group by organization_id,branch_id,kind,record_id,target_id,staff_id;

revoke all on public.staff_work_participation,public.staff_completed_work from public,anon,authenticated;
grant select on public.staff_work_participation,public.staff_completed_work to authenticated;
