
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";
import { ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon, Search as SearchIcon, X as XIcon, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";

import { CustomerForm, type CustomerRecord } from "@/components/crm-forms";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { EmptyState, FilterBar, PageHeader, StatusPill } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { displayPhone } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

const PAGE_SIZE=20;
type CustomerListRow={id:string;full_name:string;phone:string|null;email:string|null;is_archived:boolean;updated_at:string;vehicles?:Array<{count:number}>};
type VisitRow={customer_id:string;starts_at:string|null;branches:{name:string;timezone:string}|{name:string;timezone:string}[]|null};
type Params={q?:string;status?:string;page?:string;create?:string;edit?:string;message?:string;error?:string;warning?:string;duplicateId?:string};
export default async function CustomersPage({searchParams}:{searchParams:Promise<Params>}) {
  const [p,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  if(activeMembership.industry === "hospitality") { const { HospitalityGuests } = await import("@/components/hospitality/guests"); return <HospitalityGuests query={p}/>; }
  const config=resolveIndustryConfig(activeMembership.industry),salon=config.key!=="automotive";
  const page=Math.max(1,Number(p.page)||1),archived=p.status==="archived",q=p.q?.trim().replace(/[,%()]/g," ").slice(0,100);
  const projection=salon?"id,full_name,phone,email,is_archived,updated_at":"id,full_name,phone,email,is_archived,updated_at,vehicles(count)";
  let query=supabase.from("customers").select(projection,{count:"exact"}).eq("organization_id",activeMembership.organizationId).eq("is_archived",archived);
  if(q) query=query.or(`full_name.ilike.%${q}%,phone_normalized.ilike.%${q.replace(/\D/g,"")}%,email.ilike.%${q}%`);
  const [listResult,editResult]=await Promise.all([query.order("updated_at",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1),p.edit?supabase.from("customers").select("id,full_name,phone,email,address_line,city,province,notes").eq("organization_id",activeMembership.organizationId).eq("id",p.edit).maybeSingle():Promise.resolve({data:null})]);
  const {count,error}=listResult;
  const data=listResult.data as unknown as CustomerListRow[]|null;
  const customerIds=data?.map(customer=>customer.id)??[],now=new Date().toISOString();
  const [upcomingResult,lastVisitResult]=salon&&customerIds.length?await Promise.all([
    supabase.from("appointments").select("customer_id,starts_at,branches(name,timezone)").eq("organization_id",activeMembership.organizationId).in("customer_id",customerIds).in("status",["requested","confirmed"]).gte("starts_at",now).order("starts_at"),
    supabase.from("appointments").select("customer_id,starts_at,branches(name,timezone)").eq("organization_id",activeMembership.organizationId).in("customer_id",customerIds).eq("status","completed").lte("starts_at",now).order("starts_at",{ascending:false}),
  ]):[{data:[]},{data:[]}];
  const upcomingByCustomer=firstVisitByCustomer(upcomingResult.data as unknown as VisitRow[]),lastVisitByCustomer=firstVisitByCustomer(lastVisitResult.data as unknown as VisitRow[]);
  const pages=Math.max(1,Math.ceil((count??0)/PAGE_SIZE)),canWrite=["owner","manager","advisor"].includes(activeMembership.role);
  const listHref=`/dashboard/customers?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${page}`;
  return <main id={salon?"salon-clients-page":"customers-page"} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={salon?"salon-clients-page-header":"customers-page-header"} eyebrow={`${config.terminology.customer} CRM`} title={`${config.terminology.customer}s`} description={salon?"Search client contact details and booking context.":"Search contacts and open their vehicles in a few taps."} action={canWrite?<Button id={salon?"salon-client-create-button":"customer-create-button"} asChild><Link href={`${listHref}&create=1`}><Plus size={17}/>Add {config.terminology.customer.toLowerCase()}</Link></Button>:undefined}/>
    <FormMessage message={p.message} error={p.error??(error?"Unable to load customers.":undefined)}/>
    <ListTabs id="customers-tabs" baseHref="/dashboard/customers" query={p} value={archived?"archived":"active"} options={[{value:"active",label:"Active"},{value:"archived",label:"Archived"}]}/>
    <FilterBar id={salon?"salon-clients-filter-bar":"customers-filter-bar"}><form id={salon?"salon-clients-filter-form":"customers-filter-form"} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative"><span className="sr-only">Search {salon?"clients":"customers"}</span><Search className="absolute left-3 top-3.5 text-zinc-400" size={18}/><input id={salon?"salon-clients-search-input":"customers-search-input"} name="q" defaultValue={p.q} placeholder="Name, mobile, or email" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3"/></label>
      <input type="hidden" name="status" value={archived?"archived":"active"}/><Button id={salon?"salon-clients-search-button":"customers-search-button"} type="submit" variant="secondary"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Search</Button>
    </form></FilterBar>
    {data?.length?<RecordTable id={salon?"salon-clients-table":"customers-table"} className="mt-4" caption="Customer directory" columns={[{key:"name",label:config.terminology.customer},{key:"contact",label:"Contact",secondary:true},{key:"context",label:salon?"Visits":"Vehicles",secondary:true},...(canWrite?[{key:"status",label:"Status",secondary:true}]:[]),{key:"actions",label:canWrite?"Actions":"Status",align:"right"}]} rows={data.map(c=>({id:`${salon?"salon-client":"customer"}-row-${c.id}`,cells:{name:<RecordLink id={`${salon?"salon-client":"customer"}-link-${c.id}`} href={`/dashboard/customers/${c.id}`}>{c.full_name}</RecordLink>,contact:<><p>{displayPhone(c.phone)}</p><p className="text-xs">{c.email||"No email"}</p></>,context:salon?<><p className="text-xs">Upcoming: {visitLabel(upcomingByCustomer.get(c.id),activeMembership.timezone,"None")}</p><p className="mt-1 text-xs">Last visit: {visitLabel(lastVisitByCustomer.get(c.id),activeMembership.timezone,"No visits")}</p></>:c.vehicles?.[0]?.count??0,status:<StatusPill active={!c.is_archived}/>,actions:canWrite?<Button id={`${salon?"salon-client":"customer"}-edit-${c.id}`} asChild variant="secondary" size="sm"><Link href={`${listHref}&edit=${c.id}`}><Pencil size={14} aria-hidden="true"/>Edit</Link></Button>:<StatusPill active={!c.is_archived}/>
  },mobile:<><p>{displayPhone(c.phone)}</p><p>{c.email||"No email"}</p>{salon?<><p>Upcoming: {visitLabel(upcomingByCustomer.get(c.id),activeMembership.timezone,"None")}</p><p>Last visit: {visitLabel(lastVisitByCustomer.get(c.id),activeMembership.timezone,"No visits")}</p></>:<p>{c.vehicles?.[0]?.count??0} vehicles</p>}</>}))}/>:<div className="mt-4"><EmptyState id={salon?"salon-clients-empty-state":"customers-empty-state"} title={q?"No results match your filters":`No ${config.terminology.customer.toLowerCase()}s yet`} description={q?"Try a different search or clear the current filters.":salon?"Add your first client to begin creating appointments.":"Add your first customer to start building customer and vehicle records."} action={q?<Button asChild variant="secondary"><Link href="/dashboard/customers"><XIcon aria-hidden="true" size={16} className="shrink-0"/>Clear filters</Link></Button>:undefined}/></div>}
    {pages>1&&<nav id="customers-pagination" aria-label="Customer pages" className="mt-4 flex items-center justify-between"><Button asChild variant="secondary"><Link href={`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.max(1,page-1)}`}><ArrowLeftIcon aria-hidden="true" size={16} className="shrink-0"/>Previous</Link></Button><span className="text-sm text-zinc-600">Page {page} of {pages}</span><Button asChild variant="secondary"><Link href={`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.min(pages,page+1)}`}><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>Next</Link></Button></nav>}
    {canWrite&&p.create?<FormDialog id={salon?"salon-client-create-dialog":"customer-create-dialog"} title={`Add ${config.terminology.customer.toLowerCase()}`} description="Contact and address details are optional." closeHref={listHref}><CustomerForm embedded returnTo={`${listHref}&create=1`} {...p}/></FormDialog>:null}
    {canWrite&&editResult.data?<FormDialog id={salon?"salon-client-edit-dialog":"customer-edit-dialog"} title={`Edit ${editResult.data.full_name}`} closeHref={listHref}><CustomerForm customer={editResult.data as CustomerRecord} embedded returnTo={`${listHref}&edit=${editResult.data.id}`} {...p}/></FormDialog>:null}
  </main>;
}

function firstVisitByCustomer(rows:VisitRow[]) { const result=new Map<string,VisitRow>();for(const row of rows) if(!result.has(row.customer_id)) result.set(row.customer_id,row);return result; }
function visitLabel(visit:VisitRow|undefined,timeZone:string,fallback:string) { if(!visit?.starts_at)return fallback;const branch=Array.isArray(visit.branches)?visit.branches[0]:visit.branches;return `${new Intl.DateTimeFormat("en-PH",{timeZone:branch?.timezone??timeZone,dateStyle:"medium"}).format(new Date(visit.starts_at))}${branch?.name?` · ${branch.name}`:""}`; }
