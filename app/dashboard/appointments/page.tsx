import { Input } from "@/components/ui/input";
import { redirect } from "next/navigation";

import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";

import { ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon, Plus as PlusIcon, Search as SearchIcon, X as XIcon } from "lucide-react";
import Link from "next/link";
import { FormMessage } from "@/components/form-message";
import { OpenQueueDisplay } from "@/components/open-queue-display";
import { EmptyState, PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration,formatMoney,appointmentAgendaRange } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { assignmentContextLabel, loadAppointmentAssignmentContext } from "@/modules/core/scheduling/appointment-assignment-view";
import { resolveIndustryConfig } from "@/modules/platform/industry";
import { salonAppointmentStatuses } from "@/modules/salon/appointments";

const PAGE_SIZE=25;
type AppointmentRow={id:string;status:string;source:string;starts_at:string|null;ends_at:string|null;expected_total_centavos:number;expected_duration_minutes:number|null;customers:{full_name:string}|{full_name:string}[]|null;vehicles?:{make:string|null;model:string|null;plate_number:string|null}|{make:string|null;model:string|null;plate_number:string|null}[]|null;appointment_services:{service_name_snapshot:string}[]};
type AppointmentView={appointment:AppointmentRow;customerName:string;vehicleName:string;services:string;staff:string;resources:string;time:string};

export default async function Page({searchParams}:{searchParams:Promise<{date?:string;view?:string;status?:string;q?:string;page?:string;message?:string;error?:string}>}) {
  const [params,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  if(activeMembership.industry==="pet_care") redirect("/dashboard/pet-care/appointments");
  const config=resolveIndustryConfig(activeMembership.industry),salon=config.key==="salon";
  const date=params.date??new Intl.DateTimeFormat("en-CA",{timeZone:activeMembership.timezone}).format(new Date());
  const days=params.view==="week"?7:1,range=appointmentAgendaRange(date,days,activeMembership.timezone),page=Math.max(1,Number.parseInt(params.page??"1",10)||1),search=params.q?.trim().slice(0,100);
  let directory=range?supabase.from("appointment_directory").select("id",{count:"exact"}).eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).gte("starts_at",range.start.toISOString()).lt("starts_at",range.end.toISOString()).order("starts_at").range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1):null;
  if(params.status&&directory) directory=directory.eq("status",params.status);
  if(search&&directory) directory=directory.ilike("search_document",`%${search.replace(/[,%()]/g," ")}%`);
  const {data:matches,count,error:searchError}=directory?await directory:{data:null,count:0,error:null},ids=matches?.map(match=>match.id)??[];
  const appointmentProjection=salon?"id,status,source,starts_at,ends_at,expected_total_centavos,expected_duration_minutes,customers(full_name),appointment_services(service_name_snapshot)":"id,status,source,starts_at,ends_at,expected_total_centavos,expected_duration_minutes,customers(full_name),vehicles(make,model,plate_number),appointment_services(service_name_snapshot)";
  const {data,error}=ids.length?await supabase.from("appointments").select(appointmentProjection).in("id",ids):{data:[],error:null};
  const assignmentContext=await loadAppointmentAssignmentContext(activeMembership.organizationId,ids);
  const rows=(data??[]) as unknown as AppointmentRow[],byId=new Map(rows.map(row=>[row.id,row]));
  const appointments=ids.map(id=>byId.get(id)).filter((row):row is AppointmentRow=>Boolean(row));
  const views:AppointmentView[]=appointments.map(appointment=>{
    const customer=Array.isArray(appointment.customers)?appointment.customers[0]:appointment.customers;
    const vehicle=Array.isArray(appointment.vehicles)?appointment.vehicles[0]:appointment.vehicles;
    const labels=assignmentContextLabel(assignmentContext.get(appointment.id)??{scheduledStaff:[],scheduledResources:[]});
    return {appointment,customerName:customer?.full_name??"Client not assigned",vehicleName:vehicle?[vehicle.make,vehicle.model,vehicle.plate_number&&`(${vehicle.plate_number})`].filter(Boolean).join(" "):"Vehicle not assigned",services:appointment.appointment_services.map(item=>item.service_name_snapshot).join(", "),staff:labels.staff,resources:labels.resources,time:new Intl.DateTimeFormat("en-PH",{timeZone:activeMembership.timezone,weekday:days>1?"short":undefined,hour:"numeric",minute:"2-digit"}).format(new Date(appointment.starts_at!))};
  });
  const canWrite=["owner","manager","advisor"].includes(activeMembership.role),pages=Math.max(1,Math.ceil((count??0)/PAGE_SIZE));
  const href=(target:number)=>{const next=new URLSearchParams();for(const [key,value] of Object.entries(params))if(value)next.set(key,value);next.set("page",String(target));return `?${next}`;};
  const statuses=salon?[...salonAppointmentStatuses]:["requested","confirmed","checked_in","queued","completed","cancelled","no_show"];

  return <main id={salon?"salon-appointments-page":"appointments-page"} className="mx-auto min-w-0 max-w-7xl"><PageHeader id={salon?"salon-appointments-page-header":"appointments-page-header"} eyebrow={activeMembership.branchName} title="Appointments" description={`Day and week agenda in ${activeMembership.timezone}.`} action={<div className="flex flex-wrap gap-2">{salon?<OpenQueueDisplay branchId={activeMembership.branchId}/>:null}{canWrite&&salon?<Button asChild variant="secondary"><Link id="salon-add-walk-in-button" href="/dashboard/appointments/new?mode=walk-in"><PlusIcon size={16} aria-hidden="true"/>Add walk-in</Link></Button>:null}{canWrite?<Button asChild><Link id={salon?"salon-appointment-create-button":"appointment-create-button"} href="/dashboard/appointments/new"><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>New appointment</Link></Button>:null}</div>}/>
    <FormMessage message={params.message} error={params.error??(!range?"Enter a valid date for this timezone.":searchError||error?"Unable to load appointments.":undefined)}/>
    <ListTabs id="appointment-range-tabs" baseHref="/dashboard/appointments" query={{...params,date}} parameter="view" value={days===7?"week":"day"} options={[{value:"day",label:"Day"},{value:"week",label:"Week"}]}/>
    <form id={salon?"salon-appointments-filter-form":"appointments-filter-form"} className="mt-5 grid min-w-0 gap-3 rounded-ui-lg border border-admin-border bg-white p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end"><label className="min-w-0 text-xs font-medium text-slate-600">Search<input id={salon?"salon-appointments-search-input":"appointments-search-input"} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-zinc-950" name="q" defaultValue={params.q} placeholder={salon?"Client, phone, or treatment":"Customer, plate, vehicle, or service"}/></label><label className="text-xs font-medium text-slate-600">Date<Input id={salon?"salon-appointments-date-input":"appointments-date-input"} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3" type="date" name="date" defaultValue={date}/></label><input type="hidden" name="view" value={days===7?"week":"day"}/><label className="text-xs font-medium text-slate-600">Status<select id={salon?"salon-appointments-status-select":"appointments-status-select"} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 capitalize" name="status" defaultValue={params.status??""}><option value="">All statuses</option>{statuses.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label><Button id={salon?"salon-appointments-filter-button":"appointments-filter-button"} className="w-full xl:w-auto" variant="secondary" type="submit"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Apply filters</Button></form>
    <div id={salon?"salon-calendar":"appointments-list"} className="mt-4"><AppointmentTable currency={activeMembership.currency} views={views} salon={salon}/></div>
    {range&&!searchError&&!error&&views.length===0&&<div className="mt-6"><EmptyState id={salon?"salon-appointments-empty-state":"appointments-empty-state"} title="No appointments scheduled" description={params.q||params.status?`No matching visits were found for this ${days>1?"week":"day"}. Try clearing the filters.`:`Create your first ${salon?"Client ":""}appointment to start managing the schedule.`} action={params.q||params.status?<Button asChild variant="secondary"><Link id={salon?"salon-appointments-clear-filters":"appointments-clear-filters"} href={`/dashboard/appointments?date=${date}&view=${params.view??"day"}`}><XIcon aria-hidden="true" size={16} className="shrink-0"/>Clear filters</Link></Button>:canWrite?<Button asChild><Link id={salon?"salon-appointments-empty-create":"appointments-empty-create"} href="/dashboard/appointments/new"><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Create appointment</Link></Button>:undefined}/></div>}
    {pages>1&&<nav id={salon?"salon-appointments-pagination":undefined} aria-label="Appointment pages" className="mt-6 flex items-center justify-center gap-3"><Button asChild variant="secondary" disabled={page<=1}><Link href={href(Math.max(1,page-1))}><ArrowLeftIcon aria-hidden="true" size={16} className="shrink-0"/>Previous</Link></Button><span className="text-sm font-medium">Page {page} of {pages}</span><Button asChild variant="secondary" disabled={page>=pages}><Link href={href(Math.min(pages,page+1))}><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>Next</Link></Button></nav>}
  </main>;
}

function AppointmentTable({views,salon,currency}:{views:AppointmentView[];salon:boolean;currency:string}) {
  const prefix=salon?"salon-appointment":"appointment";
  return <RecordTable id={salon?"salon-appointments-table":"appointments-table"} caption="Appointment schedule" columns={[{key:"customer",label:salon?"Client / treatment":"Customer / vehicle"},{key:"time",label:"Time",secondary:true},{key:"assignment",label:"Staff / resource",secondary:true},{key:"status",label:"Status",secondary:true},{key:"estimate",label:"Estimate",align:"right"}]} rows={views.map(({appointment,customerName,vehicleName,services,staff,resources,time})=>({id:`${prefix}-row-${appointment.id}`,cells:{
    customer:<><RecordLink id={`${prefix}-link-${appointment.id}`} href={`/dashboard/appointments/${appointment.id}`}>{customerName}</RecordLink>{!salon&&<p className="mt-1 text-xs text-admin-text-secondary">{vehicleName}</p>}<p className="mt-1 text-xs text-admin-text-secondary">{services}</p></>,time,assignment:<><strong>{staff}</strong><p className="text-xs text-admin-text-secondary">{resources}</p></>,status:<span className="text-xs capitalize">{appointment.status.replaceAll("_"," ")}</span>,estimate:<><strong className="tabular-nums">{formatMoney(appointment.expected_total_centavos, currency)}</strong><p className="mt-1 text-xs text-admin-text-secondary">{appointment.expected_duration_minutes?formatDuration(appointment.expected_duration_minutes):"No estimate"}</p></>,
  },mobile:<><p>{time} · <span className="capitalize">{appointment.status.replaceAll("_"," ")}</span></p><p id={`${salon?"salon-":""}appointment-assignment-context-${appointment.id}`}>{staff} · {resources}</p></>}))}/>;
}
