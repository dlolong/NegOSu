
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";

import { ArrowRight as ArrowRightIcon, Pause as PauseIcon } from "lucide-react";
import Link from "next/link";

import { endTechnicianWork } from "@/app/dashboard/job-actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { WorkSessionTimer } from "@/components/work-session-timer";
import { getDashboardContext } from "@/lib/auth/context";
import { jobNumber } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { shouldUseLegacyAutomotiveWorkReads, type DatabaseError } from "@/lib/supabase/schema-compatibility";
import { formatWorkDuration, getAutomotiveWorkSessionElapsedSeconds, type AutomotiveWorkSession } from "@/modules/automotive/work-tracking/work-session.service";

type Query = { tab?: string; message?: string; error?: string };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, { activeMembership, user }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const { jobs, sessionRows, actorStaffId, jobsError, sessionsError, actorError } = await loadTechnicianWork(
    supabase,
    activeMembership.organizationId,
    activeMembership.branchId,
    activeMembership.membershipId,
    user.id,
  );
  const sessions = ((sessionRows ?? []) as Record<string, unknown>[]).map(mapSession);
  const active = sessions.filter(({ status }) => status === "active");
  const isManager = ["owner", "manager", "advisor"].includes(activeMembership.role);
  const ownActive = active.filter(({ staffId }) => staffId === actorStaffId);
  const visibleActive = isManager ? active : ownActive;
  const assignedJobs = (jobs ?? []).filter((job) => isManager || job.primary_technician_staff_id === actorStaffId || job.job_order_items.some((item: { technician_staff_id: string | null }) => item.technician_staff_id === actorStaffId));
  const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date());
  const completedToday = sessions.filter((session) => session.staffId === actorStaffId && session.endedAt && new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date(session.endedAt)) === today);
  const tab=["assigned","history"].includes(query.tab??"")?query.tab!:"active";
  const history=sessions.filter(session=>session.status!=="active"&&(isManager||session.staffId===actorStaffId));
  const historyIds=tab==="history"?[...new Set(history.map(session=>session.jobOrderId))]:[];
  const historyJobs=historyIds.length?await supabase.from("job_orders").select("id,job_number,created_at").eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).in("id",historyIds):{data:[],error:null};
  const historyLabels=new Map((historyJobs.data??[]).map(job=>[job.id,jobNumber(job.job_number??0,new Date(job.created_at).getFullYear())]));
  return <main id="technician-my-work-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="technician-my-work-header" eyebrow={activeMembership.branchName} title={isManager ? "Technician Work" : "My Work"} description={isManager ? "Current technician sessions and assigned Job Orders." : "Your active timer and assigned Job Orders."} action={<Button asChild variant="secondary"><Link href="/dashboard/jobs"><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>All Job Orders</Link></Button>}/>
    <FormMessage {...query} error={query.error ?? (jobsError || sessionsError || actorError || historyJobs.error ? "Unable to load technician work." : undefined)}/>
    <ListTabs id="technician-work-tabs" baseHref="/dashboard/my-work" query={query} parameter="tab" value={tab} options={[{value:"active",label:"Working",count:visibleActive.length},{value:"assigned",label:"Assigned",count:assignedJobs.length},{value:"history",label:"History",count:history.length}]}/>
    {tab==="active"?<section id="technician-active-job" className="mt-4"><RecordTable id="technician-active-jobs-table" caption="Active work sessions" empty="No active work sessions. Start work from an assigned job order." columns={[{key:"job",label:"Job / technician"},{key:"timer",label:"Elapsed time",secondary:true},{key:"actions",label:"Actions",align:"right"}]} rows={visibleActive.map(session=>{const job=jobsById.get(session.jobOrderId),vehicle=job?one(job.vehicles):null,customer=job?one(job.customers):null;return {id:`technician-active-job-${session.id}`,cells:{job:<><RecordLink id={`technician-active-job-link-${session.id}`} href={`/dashboard/jobs/${session.jobOrderId}`}>{vehicle?`${vehicle.make} ${vehicle.model}`:"Active job order"}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{customer?.full_name??"Customer"} · {session.technicianName}</p></>,timer:<WorkSessionTimer id={`technician-active-job-timer-${session.id}`} startedAt={session.startedAt} className="font-medium tabular-nums"/>,actions:<div className="flex flex-wrap justify-end gap-2"><SessionEndForm session={session} action="pause"/><SessionEndForm session={session} action="stop"/></div>},mobile:<WorkSessionTimer id={`technician-active-job-timer-mobile-${session.id}`} startedAt={session.startedAt}/>};})}/></section>:null}
    {tab==="assigned"?<section id="technician-assigned-jobs" className="mt-4"><RecordTable id="technician-assigned-jobs-table" caption="Assigned job orders" empty="No assigned active job orders." columns={[{key:"job",label:"Job"},{key:"vehicle",label:"Vehicle / customer",secondary:true},{key:"status",label:"Status",align:"right"}]} rows={assignedJobs.map(job=>{const vehicle=one(job.vehicles),customer=one(job.customers);return {id:`technician-assigned-job-row-${job.id}`,cells:{job:<RecordLink id={`technician-job-link-${job.id}`} href={`/dashboard/jobs/${job.id}#job-order-work-tracking-section`}>{jobNumber(job.job_number??0,new Date(job.created_at).getFullYear())}</RecordLink>,vehicle:<><strong>{vehicle?.make} {vehicle?.model}</strong><p className="text-xs text-admin-text-secondary">{customer?.full_name}</p></>,status:<span className="text-xs capitalize">{job.status.replaceAll("_"," ")}</span>},mobile:<><p>{vehicle?.make} {vehicle?.model}</p><p>{customer?.full_name}</p></>};})}/></section>:null}
    {tab==="history"?<section id="technician-work-history" className="mt-4"><RecordTable id="technician-work-history-table" caption="Work session history" empty="No completed or paused sessions yet." columns={[{key:"job",label:"Job / technician"},{key:"ended",label:"Ended",secondary:true},{key:"duration",label:"Duration",align:"right"}]} rows={history.map(session=>({id:`technician-history-${session.id}`,cells:{job:<><RecordLink id={`technician-history-link-${session.id}`} href={`/dashboard/jobs/${session.jobOrderId}`}>{historyLabels.get(session.jobOrderId)??"Job order"}</RecordLink><p className="text-xs text-admin-text-secondary">{session.technicianName} · {session.status}</p></>,ended:session.endedAt?new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(session.endedAt)):"—",duration:formatWorkDuration(getAutomotiveWorkSessionElapsedSeconds(session))},mobile:<p>{session.endedAt?new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(session.endedAt)):"—"}</p>}))}/></section>:null}
    {!isManager ? <section id="technician-completed-today" className="mt-6 rounded-2xl border bg-white p-4"><h2 className="font-medium">Completed sessions today</h2><p className="mt-1 text-2xl font-medium">{completedToday.length}</p><p className="text-sm text-zinc-500">{formatWorkDuration(completedToday.reduce((sum, session) => sum + getAutomotiveWorkSessionElapsedSeconds(session), 0))} labor effort</p></section> : null}
  </main>;
}

function SessionEndForm({ session, action }: { session: AutomotiveWorkSession; action: "pause" | "stop" }) {
  return <form id={`technician-${action}-work-form-${session.id}`} action={endTechnicianWork}><input type="hidden" name="jobId" value={session.jobOrderId}/><input type="hidden" name="sessionId" value={session.id}/><input type="hidden" name="action" value={action}/><SubmitButton id={`technician-${action}-work-button-${session.id}`} size="sm" pendingText="Saving…" variant={action === "stop" ? "destructive" : "secondary"}><PauseIcon aria-hidden="true" size={16} className="shrink-0"/>{action === "pause" ? "Pause" : "Stop session"}</SubmitButton></form>;
}

function mapSession(session: Record<string, unknown>): AutomotiveWorkSession { return { id:String(session.id),jobOrderId:String(session.job_order_id),staffId:String(session.technician_staff_id),userId:session.technician_user_id?String(session.technician_user_id):null,technicianName:String(session.technician_name_snapshot),startedAt:String(session.started_at),endedAt:session.ended_at?String(session.ended_at):null,status:String(session.status) as AutomotiveWorkSession["status"],endReason:session.end_reason?String(session.end_reason) as AutomotiveWorkSession["endReason"]:null,notes:session.notes?String(session.notes):null }; }
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

type TechnicianJob = {
  id: string;
  job_number: number | null;
  status: string;
  created_at: string;
  primary_technician_staff_id: string | null;
  customers: { full_name: string } | Array<{ full_name: string }> | null;
  vehicles: { make: string | null; model: string | null; plate_number: string | null } | Array<{ make: string | null; model: string | null; plate_number: string | null }> | null;
  job_order_items: Array<{ technician_staff_id: string | null }>;
};

async function loadTechnicianWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  branchId: string,
  membershipId: string,
  userId: string,
): Promise<{
  jobs: TechnicianJob[];
  sessionRows: Array<Record<string, unknown>>;
  actorStaffId: string | null;
  jobsError: DatabaseError;
  sessionsError: DatabaseError;
  actorError: DatabaseError;
}> {
  const [jobsResult, sessionsResult, actorResult] = await Promise.all([
    supabase.from("job_orders").select("id,job_number,status,created_at,primary_technician_staff_id,customers(full_name),vehicles(make,model,plate_number),job_order_items(technician_staff_id)").eq("organization_id", organizationId).eq("branch_id", branchId).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(100),
    supabase.from("automotive_job_order_work_sessions").select("id,job_order_id,technician_staff_id,technician_user_id,technician_name_snapshot,started_at,ended_at,status,end_reason,notes").eq("organization_id", organizationId).eq("branch_id", branchId).order("started_at", { ascending: false }).limit(250),
    supabase.from("organization_staff_profiles").select("id").eq("organization_id",organizationId).eq("membership_id",membershipId).maybeSingle(),
  ]);
  const useLegacy = shouldUseLegacyAutomotiveWorkReads({
    jobs: jobsResult.error,
    sessions: sessionsResult.error,
    actorProfile: actorResult.error,
  });

  if (!useLegacy) {
    return {
      jobs: (jobsResult.data ?? []) as unknown as TechnicianJob[],
      sessionRows: (sessionsResult.data ?? []) as unknown as Array<Record<string, unknown>>,
      actorStaffId: actorResult.data?.id ?? null,
      jobsError: jobsResult.error,
      sessionsError: sessionsResult.error,
      actorError: actorResult.error,
    };
  }

  const [legacyJobs, legacySessions] = await Promise.all([
    supabase.from("job_orders").select("id,job_number,status,created_at,primary_technician_user_id,customers(full_name),vehicles(make,model,plate_number),job_order_items(technician_user_id)").eq("organization_id", organizationId).eq("branch_id", branchId).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(100),
    supabase.from("automotive_job_order_work_sessions").select("id,job_order_id,technician_user_id,technician_name_snapshot,started_at,ended_at,status,end_reason,notes").eq("organization_id", organizationId).eq("branch_id", branchId).order("started_at", { ascending: false }).limit(250),
  ]);
  const jobs = ((legacyJobs.data ?? []) as unknown as Array<Record<string, unknown> & { job_order_items: Array<{ technician_user_id: string | null }> }>).map((job) => ({
    ...job,
    primary_technician_staff_id: job.primary_technician_user_id ? String(job.primary_technician_user_id) : null,
    job_order_items: job.job_order_items.map((item) => ({ technician_staff_id: item.technician_user_id })),
  })) as unknown as TechnicianJob[];
  const sessionRows = ((legacySessions.data ?? []) as unknown as Array<Record<string, unknown>>).map((session) => ({
    ...session,
    technician_staff_id: session.technician_user_id,
  }));
  return {
    jobs,
    sessionRows,
    actorStaffId: userId,
    jobsError: legacyJobs.error,
    sessionsError: legacySessions.error,
    actorError: null,
  };
}
