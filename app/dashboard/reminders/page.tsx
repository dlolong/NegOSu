import { PlanUpgradeNotice } from "@/components/plan-upgrade";
import { SearchableSelect } from "@/components/searchable-select";

import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { PageHeader } from "@/components/page-patterns";
import { RecordLink } from "@/components/record-item";

import { AlarmClock as AlarmClockIcon, Play as PlayIcon, Plus as PlusIcon, Power as PowerIcon, Save as SaveIcon, Search as SearchIcon, X as XIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import Link from "next/link";

import { activateBackfilledMaintenance,dismissVehicleMaintenance,resumeVehicleMaintenance,saveMaintenanceRule,snoozeVehicleMaintenance } from "@/app/dashboard/reminders/actions";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isMaintenanceAppointmentActive,type MaintenanceAppointmentStatus } from "@/modules/automotive/maintenance/reminder-eligibility";

type MaintenanceRow={
  id:string;vehicle_id:string;customer_id:string;service_id:string;customer_name:string;service_name:string;
  make:string|null;model:string|null;plate_number:string|null;last_service_at:string;last_service_odometer_km:number|null;
  next_due_at:string|null;next_due_odometer_km:number|null;due_status:string;lifecycle_status:string;
  appointment_id:string|null;appointment_status:MaintenanceAppointmentStatus;appointment_starts_at:string|null;
  snoozed_until:string|null;notifications_enabled:boolean;source:"live"|"legacy_backfill";reminder_eligibility:string;
};
type DeliveryRow={due_id:string;channel:"email"|"sms";status:string;eligibility_reason:string|null;sent_at:string|null};
const statuses=["all","overdue","due","due_soon","upcoming"] as const;

function displayDate(value:string,timeZone:string,withTime=false){
  return new Intl.DateTimeFormat("en-PH",withTime?{dateStyle:"medium",timeStyle:"short",timeZone}:{dateStyle:"medium",timeZone}).format(new Date(value));
}

function dueLabel(row:MaintenanceRow,timeZone:string){
  const date=row.next_due_at?displayDate(row.next_due_at,timeZone):null;
  const km=row.next_due_odometer_km!=null?`${row.next_due_odometer_km.toLocaleString("en-PH")} km`:null;
  return [date,km].filter(Boolean).join(" or ");
}

function reminderLabel(row:MaintenanceRow,delivery:DeliveryRow[]|undefined,timeZone:string){
  if(row.reminder_eligibility==="ACTIVE_RELATED_APPOINTMENT")return"Suppressed — appointment active";
  if(row.reminder_eligibility==="SNOOZED"&&row.snoozed_until)return`Snoozed until ${displayDate(row.snoozed_until,timeZone)}`;
  if(row.reminder_eligibility==="LEGACY_BACKFILL_NOT_ACTIVATED")return"Paused — legacy backfill";
  const sent=delivery?.filter(item=>item.status==="sent").sort((a,b)=>String(b.sent_at).localeCompare(String(a.sent_at)))[0];
  if(sent)return`Sent by ${sent.channel.toUpperCase()}`;
  if(delivery?.some(item=>item.status==="pending"||item.status==="processing"))return"Queued";
  if(delivery?.some(item=>item.status==="failed"))return"Delivery failed";
  return"Eligible";
}

export default async function Page({searchParams}:{searchParams:Promise<{status?:string;q?:string;message?:string;error?:string;dialog?:string;id?:string;tab?:string}>}){
  const[query,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const selectedStatus=statuses.includes(query.status as typeof statuses[number])?query.status??"all":"all";
  const canManage=["owner","manager"].includes(activeMembership.role);
  const canOperate=["owner","manager","advisor"].includes(activeMembership.role);
  const[{data:directory},{data:services},{data:rules}]=await Promise.all([
    supabase.from("vehicle_maintenance_directory").select("*").eq("organization_id",activeMembership.organizationId).eq("lifecycle_status","active").order("next_due_at").limit(250),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("maintenance_rules").select("*").eq("organization_id",activeMembership.organizationId).eq("is_active",true),
  ]);
  const rows=(directory??[]) as MaintenanceRow[];
  const{data:deliveryRows}=rows.length?await supabase.rpc("get_vehicle_maintenance_delivery_status",{p_due_ids:rows.map(row=>row.id)}):{data:[]};
  const deliveryByDue=new Map<string,DeliveryRow[]>();
  for(const delivery of (deliveryRows??[]) as DeliveryRow[])deliveryByDue.set(delivery.due_id,[...(deliveryByDue.get(delivery.due_id)??[]),delivery]);
  const search=(query.q??"").trim().toLocaleLowerCase();
  const filtered=rows.filter(row=>(selectedStatus==="all"||row.due_status===selectedStatus)&&(!search||[row.customer_name,row.service_name,row.make,row.model,row.plate_number].some(value=>value?.toLocaleLowerCase().includes(search))));
  const counts=Object.fromEntries(statuses.slice(1).map(status=>[status,rows.filter(row=>row.due_status===status).length]));
  const selected=rows.find(row=>row.id===query.id);
  return <main id="vehicle-maintenance-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="vehicle-maintenance-page-header" eyebrow={activeMembership.branchName} title="Maintenance" description="Service recommendations, linked appointments, and reminder status."/>
    <FormMessage message={query.message} error={query.error}/>
    <ListTabs id="maintenance-tabs" baseHref="/dashboard/reminders" query={query} parameter="tab" value={canManage&&query.tab==="intervals"?"intervals":"due"} options={[{value:"due",label:"Due services"},...(canManage?[{value:"intervals",label:"Service intervals"}]:[])]}/>
    {(!canManage||query.tab!=="intervals")&&<>
    <section id="maintenance-status-summary" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{statuses.slice(1).map(status=><Link id={`maintenance-${status}-filter`} key={status} href={`/dashboard/reminders?status=${status}`} className="rounded-xl border bg-white p-3"><span className="text-xs font-bold uppercase text-zinc-500">{status.replaceAll("_"," ")}</span><strong className="block text-2xl">{counts[status]??0}</strong></Link>)}</section>
    <form id="maintenance-filters" className="mt-4 flex flex-wrap gap-2"><Input id="maintenance-search-input" className="min-w-0 flex-1 sm:min-w-72" name="q" defaultValue={query.q} placeholder="Customer, vehicle, plate, or service"/><select id="maintenance-status-select" name="status" defaultValue={selectedStatus} className="min-h-11 rounded-xl border bg-white px-3">{statuses.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select><Button id="maintenance-filter-button" type="submit"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Filter</Button></form>
    <div id="maintenance-due-list" className="mt-4"><RecordTable id="maintenance-due-table" caption="Maintenance due" columns={[{key:"vehicle",label:"Vehicle / service"},{key:"due",label:"Due",secondary:true},{key:"appointment",label:"Appointment",secondary:true},{key:"reminder",label:"Reminder",secondary:true},{key:"actions",label:"Actions",align:"right"}]} rows={filtered.map(row=>({id:`maintenance-row-${row.id}`,cells:{vehicle:<><RecordLink id={`maintenance-vehicle-link-${row.id}`} href={`/dashboard/vehicles/${row.vehicle_id}/history`}>{[row.make,row.model].filter(Boolean).join(" ")||"Vehicle"}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{row.customer_name} · {row.plate_number||"No plate"}</p><p className="mt-1 text-sm">{row.service_name}</p></>,due:<>{dueLabel(row,activeMembership.timezone)}<p className="text-xs capitalize">{row.due_status.replaceAll("_"," ")}</p></>,appointment:<div id={`maintenance-linked-appointment-${row.id}`}><AppointmentStatus row={row} timeZone={activeMembership.timezone}/></div>,reminder:<span id={`maintenance-reminder-status-${row.id}`}>{reminderLabel(row,deliveryByDue.get(row.id),activeMembership.timezone)}</span>,actions:<MaintenanceActions row={row} canOperate={canOperate} canManage={canManage}/>
    },mobile:<><p>{dueLabel(row,activeMembership.timezone)} · <span className="capitalize">{row.due_status.replaceAll("_"," ")}</span></p><AppointmentStatus row={row} timeZone={activeMembership.timezone}/><p>{reminderLabel(row,deliveryByDue.get(row.id),activeMembership.timezone)}</p></>}))}/></div></>}
    <div className="mt-4 min-w-0">
      {canManage&&query.tab==="intervals"?<Card id="maintenance-rule-card" className="h-fit p-5"><h2 className="font-semibold">Service intervals</h2><p className="mt-1 text-sm text-zinc-500">Shop-configured guidance; not a manufacturer claim.</p><PlanUpgradeNotice id="maintenance-rule-plan-upgrade" capability="reminders"/><form id="maintenance-rule-form" action={saveMaintenanceRule} className="mt-4 grid gap-3"><label className="text-sm">Service<SearchableSelect id="maintenance-rule-service-select" required name="serviceId" options={services??[]} lookup="service" placeholder="Search service or category"/></label><Input id="maintenance-rule-months-input" name="intervalMonths" type="number" min="1" max="120" placeholder="Months"/><Input id="maintenance-rule-km-input" name="intervalKm" type="number" min="100" max="500000" placeholder="Kilometers"/><Input id="maintenance-rule-lead-input" required name="leadDays" type="number" min="0" max="365" defaultValue="14"/><FormActions id="maintenance-rule-actions"><SubmitButton id="maintenance-rule-save-button" pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save interval</SubmitButton></FormActions></form><RecordTable id="maintenance-rule-list" className="mt-5" caption="Service intervals" columns={[{key:"service",label:"Service"},{key:"interval",label:"Interval",align:"right"}]} rows={(rules??[]).map(rule=>({id:`maintenance-rule-${rule.id}`,cells:{service:services?.find(service=>service.id===rule.service_id)?.name??"Service",interval:[rule.interval_months?`${rule.interval_months} months`:null,rule.interval_km?`${rule.interval_km.toLocaleString()} km`:null].filter(Boolean).join(" or ")}}))}/></Card>:null}
    </div>
    {query.dialog==="snooze"&&selected?<FormDialog id="maintenance-snooze-dialog" title="Snooze maintenance reminder" description="The maintenance due date stays unchanged." closeHref="/dashboard/reminders" size="md"><form id="maintenance-snooze-form" action={snoozeVehicleMaintenance} className="grid gap-4"><input type="hidden" name="id" value={selected.id}/><label className="text-sm font-semibold">Snooze until<Input id="maintenance-snooze-until-input" required name="snoozedUntil" type="date"/></label><label className="text-sm font-semibold">Reason (optional)<textarea id="maintenance-snooze-reason-input" name="reason" maxLength={500} className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2"/></label><FormActions id="maintenance-snooze-actions"><SubmitButton id="maintenance-snooze-confirm-button" pendingText="Snoozing…"><AlarmClockIcon aria-hidden="true" size={16} className="shrink-0"/>Snooze reminder</SubmitButton></FormActions></form></FormDialog>:null}
    {query.dialog==="dismiss"&&selected?<FormDialog id="maintenance-dismiss-dialog" title="Dismiss maintenance recommendation?" description="The due date remains in history, but reminders stop for this cycle." closeHref="/dashboard/reminders" size="md"><form id="maintenance-dismiss-form" action={dismissVehicleMaintenance} className="grid gap-4"><input type="hidden" name="id" value={selected.id}/><label className="text-sm font-semibold">Reason<textarea id="maintenance-dismiss-reason-input" required name="reason" maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border px-3 py-2"/></label><FormActions id="maintenance-dismiss-actions"><SubmitButton id="maintenance-dismiss-confirm-button" variant="destructive" pendingText="Dismissing…"><XIcon aria-hidden="true" size={16} className="shrink-0"/>Dismiss recommendation</SubmitButton></FormActions></form></FormDialog>:null}
  </main>;
}

function AppointmentStatus({row,timeZone}:{row:MaintenanceRow;timeZone:string}){
  if(!row.appointment_id)return <span className="text-zinc-500">Not booked</span>;
  const active=isMaintenanceAppointmentActive(row.appointment_status);
  return <span><Link className={`font-semibold hover:underline ${active?"text-emerald-700":"text-zinc-600"}`} href={`/dashboard/appointments/${row.appointment_id}`}>{active?"Appointment scheduled":`Previous appointment ${row.appointment_status?.replaceAll("_"," ")??"unavailable"}`}</Link>{row.appointment_starts_at?<small className="block text-zinc-500">{displayDate(row.appointment_starts_at,timeZone,true)}</small>:null}</span>;
}

function MaintenanceActions({row,canOperate,canManage}:{row:MaintenanceRow;canOperate:boolean;canManage:boolean}){
  const activeAppointment=row.appointment_id&&isMaintenanceAppointmentActive(row.appointment_status);
  const snoozed=row.snoozed_until&&new Date(row.snoozed_until)>new Date();
  return <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-2">{activeAppointment?null:<Button id={`maintenance-create-appointment-button-${row.id}`} asChild size="sm"><Link href={`/dashboard/appointments/new?maintenanceDueId=${row.id}`}><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Create appointment</Link></Button>}{canOperate?(snoozed?<form action={resumeVehicleMaintenance}><input type="hidden" name="id" value={row.id}/><SubmitButton id={`maintenance-resume-reminders-button-${row.id}`} size="sm" variant="secondary" pendingText="Resuming…"><PlayIcon aria-hidden="true" size={16} className="shrink-0"/>Resume</SubmitButton></form>:<Button id={`maintenance-snooze-button-${row.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/reminders?dialog=snooze&id=${row.id}`}><AlarmClockIcon aria-hidden="true" size={16} className="shrink-0"/>Snooze</Link></Button>):null}{canManage&&!row.notifications_enabled?<form action={activateBackfilledMaintenance}><input type="hidden" name="id" value={row.id}/><SubmitButton id={`maintenance-activate-reminders-button-${row.id}`} size="sm" variant="secondary" pendingText="Activating…"><PowerIcon aria-hidden="true" size={16} className="shrink-0"/>Activate reminders</SubmitButton></form>:null}{canOperate?<Button id={`maintenance-dismiss-button-${row.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/reminders?dialog=dismiss&id=${row.id}`}><XIcon aria-hidden="true" size={16} className="shrink-0"/>Dismiss</Link></Button>:null}</div>;
}
