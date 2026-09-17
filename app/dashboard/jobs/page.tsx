
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";
import { Search as SearchIcon, X as XIcon, Search } from "lucide-react";
import Link from "next/link";

import { FormMessage } from "@/components/form-message";
import { EmptyState, FilterBar, PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { jobNumber } from "@/lib/jobs";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { isMissingCanonicalAutomotiveStaffColumn, type DatabaseError } from "@/lib/supabase/schema-compatibility";

export default async function JobsPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;message?:string;error?:string}>}) {
  const[p,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const { rows: loadedRows, error } = await loadJobDirectory(supabase, activeMembership.organizationId, activeMembership.branchId, p.status);
  const q=p.q?.trim().toLowerCase(),rows=loadedRows.filter(row=>!q||JSON.stringify(row).toLowerCase().includes(q));
  return <main id="job-orders-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="job-orders-page-header" eyebrow={activeMembership.branchName} title="Job Orders" description="Live service-bay work, inspections, approvals, and release."/>
    <FormMessage {...p} error={p.error??(error?"Unable to load jobs.":undefined)}/>
    <ListTabs id="job-orders-tabs" baseHref="/dashboard/jobs" query={p} value={p.status??""} options={[{value:"",label:"All"},{value:"queued",label:"Queued"},{value:"in_progress",label:"Working"},{value:"completed",label:"Completed"}]}/>
    <FilterBar id="job-orders-filter-bar"><form id="job-orders-filter-form" className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_13rem_auto]"><label className="relative"><span className="sr-only">Search job orders</span><Search className="absolute left-3 top-3.5 text-zinc-400" size={18}/><input id="job-orders-search-input" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3" name="q" defaultValue={p.q} placeholder="Job number, customer, plate, or service"/></label><select id="job-orders-status-filter" className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 capitalize" name="status" defaultValue={p.status??""}><option value="">All statuses</option>{["queued","in_progress","on_hold","quality_check","ready_for_release","completed","cancelled"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select><Button type="submit" variant="secondary"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Filter</Button></form></FilterBar>
    {rows.length?<RecordTable id="job-orders-table" className="mt-4" caption="Job orders" columns={[{key:"job",label:"Job / customer"},{key:"vehicle",label:"Vehicle",secondary:true},{key:"status",label:"Status",secondary:true},{key:"amount",label:"Amount",align:"right"}]} rows={rows.map(row=>{const customer=Array.isArray(row.customers)?row.customers[0]:row.customers,vehicle=Array.isArray(row.vehicles)?row.vehicles[0]:row.vehicles;return {id:`job-order-row-${row.id}`,cells:{job:<><RecordLink id={`job-order-link-${row.id}`} href={`/dashboard/jobs/${row.id}`}>{jobNumber(row.job_number??0,new Date(row.created_at).getFullYear())}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{customer?.full_name}</p></>,vehicle:<>{vehicle?.make} {vehicle?.model}<p className="text-xs text-admin-text-secondary">{vehicle?.plate_number}</p></>,status:<><span className="capitalize">{row.status.replaceAll("_"," ")}</span><p className="text-xs text-admin-text-secondary">{row.technicianAssigned?"Technician assigned":"Unassigned"}</p></>,amount:<strong className="tabular-nums">{formatMoney(row.actual_total_centavos, activeMembership.currency)}</strong>},mobile:<><p>{vehicle?.make} {vehicle?.model} · {vehicle?.plate_number}</p><p className="capitalize">{row.status.replaceAll("_"," ")}</p><p>{row.technicianAssigned?"Technician assigned":"Unassigned"}</p></>};})}/>:<div className="mt-4"><EmptyState id="job-orders-empty-state" title={q||p.status?"No results match your filters":"No job orders yet"} description={q||p.status?"Try a different search or clear the current filters.":"Job orders appear here after a queue entry is converted."} action={q||p.status?<Button asChild variant="secondary"><Link href="/dashboard/jobs"><XIcon aria-hidden="true" size={16} className="shrink-0"/>Clear filters</Link></Button>:undefined}/></div>}
  </main>;
}

type JobDirectoryRow = {
  id: string;
  job_number: number | null;
  status: string;
  created_at: string;
  actual_total_centavos: number;
  technicianAssigned: boolean;
  customers: { full_name: string } | Array<{ full_name: string }> | null;
  vehicles: { make: string | null; model: string | null; plate_number: string | null } | Array<{ make: string | null; model: string | null; plate_number: string | null }> | null;
  job_order_items: Array<{ service_name_snapshot: string }>;
};

async function loadJobDirectory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  branchId: string,
  status?: string,
): Promise<{ rows: JobDirectoryRow[]; error: DatabaseError }> {
  const baseFields = "id,job_number,status,created_at,actual_total_centavos,customers(full_name),vehicles(make,model,plate_number),job_order_items(service_name_snapshot)";
  let canonicalQuery = supabase.from("job_orders").select(`${baseFields},primary_technician_staff_id`)
    .eq("organization_id",organizationId).eq("branch_id",branchId).order("created_at",{ascending:false}).limit(100);
  if(status) canonicalQuery=canonicalQuery.eq("status",status);
  const canonicalResult = await canonicalQuery;
  let resultData: unknown = canonicalResult.data;
  let resultError: DatabaseError = canonicalResult.error;
  let identityField = "primary_technician_staff_id";

  if (isMissingCanonicalAutomotiveStaffColumn(resultError)) {
    let legacyQuery = supabase.from("job_orders").select(`${baseFields},primary_technician_user_id`)
      .eq("organization_id",organizationId).eq("branch_id",branchId).order("created_at",{ascending:false}).limit(100);
    if(status) legacyQuery=legacyQuery.eq("status",status);
    const legacyResult = await legacyQuery;
    resultData = legacyResult.data;
    resultError = legacyResult.error;
    identityField = "primary_technician_user_id";
  }

  const rows = ((resultData ?? []) as Array<Omit<JobDirectoryRow,"technicianAssigned"> & Record<string, unknown>>)
    .map((row) => ({ ...row, technicianAssigned: Boolean(row[identityField]) }));
  return { rows, error: resultError };
}
