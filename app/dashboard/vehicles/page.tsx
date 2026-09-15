
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";
import { ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon, Search as SearchIcon, X as XIcon, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";

import { VehicleForm, type VehicleRecord } from "@/components/crm-forms";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { EmptyState, FilterBar, PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { vehicleLabel } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE=20;
type Params={q?:string;status?:string;page?:string;create?:string;edit?:string;customerId?:string;message?:string;error?:string;warning?:string;duplicateId?:string};
type VehicleRow={id:string;customer_id:string;customer_name:string;customer_phone:string|null;make:string;model:string;model_year:number|null;plate_number:string|null;vehicle_type:string|null;odometer_km:number|null};
export default async function VehiclesPage({searchParams}:{searchParams:Promise<Params>}) {
  const[p,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const page=Math.max(1,Number(p.page)||1),archived=p.status==="archived",q=p.q?.trim().replace(/[,%()]/g," ").slice(0,100),normalized=q?.replace(/\W/g,"");
  let query=supabase.from("vehicle_directory").select("id,customer_id,customer_name,customer_phone,make,model,model_year,plate_number,vehicle_type,odometer_km",{count:"exact"}).eq("organization_id",activeMembership.organizationId).eq("is_archived",archived).order("updated_at",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if(q)query=query.or(`plate_normalized.ilike.%${normalized}%,make.ilike.%${q}%,model.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone_normalized.ilike.%${normalized}%`);
  const [{data,count,error},{data:customers},editResult]=await Promise.all([query,supabase.from("customers").select("id,full_name").eq("organization_id",activeMembership.organizationId).eq("is_archived",false).order("full_name").limit(200),p.edit?supabase.from("vehicles").select("id,customer_id,make,model,plate_number,model_year,variant,color,vehicle_type,fuel_type,transmission,odometer_km,vin,engine_number,notes").eq("organization_id",activeMembership.organizationId).eq("id",p.edit).maybeSingle():Promise.resolve({data:null})]);
  const pages=Math.max(1,Math.ceil((count??0)/PAGE_SIZE)),canWrite=["owner","manager","advisor"].includes(activeMembership.role),rows=(data??[]) as VehicleRow[];
  const listHref=`/dashboard/vehicles?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${page}`;
  return <main id="vehicles-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="vehicles-page-header" eyebrow="Vehicle directory" title="Vehicles" description="Find vehicles by plate, owner, make, model, or mobile." action={canWrite?<Button id="vehicle-create-button" asChild><Link href={`${listHref}&create=1`}><Plus size={17}/>Add vehicle</Link></Button>:undefined}/>
    <FormMessage message={p.message} error={p.error??(error?"Unable to load vehicles.":undefined)}/>
    <ListTabs id="vehicles-tabs" baseHref="/dashboard/vehicles" query={p} value={archived?"archived":"active"} options={[{value:"active",label:"Active"},{value:"archived",label:"Archived"}]}/>
    <FilterBar id="vehicles-filter-bar"><form id="vehicles-filter-form" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="relative"><span className="sr-only">Search vehicles</span><Search className="absolute left-3 top-3.5 text-zinc-400" size={18}/><input id="vehicles-search-input" name="q" defaultValue={p.q} placeholder="Plate, vehicle, customer, or mobile" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3"/></label><input type="hidden" name="status" value={archived?"archived":"active"}/><Button type="submit" variant="secondary"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Search</Button></form></FilterBar>
    {rows.length?<RecordTable id="vehicles-table" className="mt-4" caption="Vehicle directory" columns={[{key:"vehicle",label:"Vehicle"},{key:"owner",label:"Owner",secondary:true},{key:"type",label:canWrite?"Type / odometer":"Type",secondary:true},{key:"actions",label:canWrite?"Actions":"Odometer",align:"right"}]} rows={rows.map(v=>({id:`vehicle-row-${v.id}`,cells:{vehicle:<><RecordLink id={`vehicle-link-${v.id}`} href={`/dashboard/vehicles/${v.id}`}>{vehicleLabel(v)}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{v.plate_number||"No plate"}</p></>,owner:<><Link href={`/dashboard/customers/${v.customer_id}`} className="font-semibold hover:underline">{v.customer_name}</Link><p className="text-xs text-admin-text-secondary">{v.customer_phone||"No mobile"}</p></>,type:<><p>{v.vehicle_type||"Not set"}</p>{canWrite&&<p className="text-xs text-admin-text-secondary">{v.odometer_km==null?"No odometer":`${v.odometer_km.toLocaleString()} km`}</p>}</>,actions:canWrite?<Button id={`vehicle-edit-${v.id}`} asChild size="sm" variant="secondary"><Link href={`${listHref}&edit=${v.id}`}><Pencil size={14} aria-hidden="true"/>Edit</Link></Button>:v.odometer_km==null?"Not set":`${v.odometer_km.toLocaleString()} km`
  },mobile:<><p>{v.customer_name} · {v.customer_phone||"No mobile"}</p><p>{v.vehicle_type||"Type not set"} · {v.odometer_km==null?"No odometer":`${v.odometer_km.toLocaleString()} km`}</p></>}))}/>:<div className="mt-4"><EmptyState id="vehicles-empty-state" title={q?"No results match your filters":"No vehicles yet"} description={q?"Try a different search or clear the current filters.":"Add a vehicle to prepare for service history and appointments."} action={q?<Button asChild variant="secondary"><Link href="/dashboard/vehicles"><XIcon aria-hidden="true" size={16} className="shrink-0"/>Clear filters</Link></Button>:undefined}/></div>}
    {pages>1&&<nav id="vehicles-pagination" aria-label="Vehicle pages" className="mt-4 flex items-center justify-between"><Button asChild variant="secondary"><Link href={`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.max(1,page-1)}`}><ArrowLeftIcon aria-hidden="true" size={16} className="shrink-0"/>Previous</Link></Button><span className="text-sm text-zinc-600">Page {page} of {pages}</span><Button asChild variant="secondary"><Link href={`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.min(pages,page+1)}`}><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>Next</Link></Button></nav>}
    {canWrite&&p.create?<FormDialog id="vehicle-create-dialog" title="Add vehicle" description="Only owner, make, and model are required." closeHref={listHref} size="xl"><VehicleForm customers={customers??[]} presetCustomerId={p.customerId} embedded returnTo={`${listHref}&create=1`} {...p}/></FormDialog>:null}
    {canWrite&&editResult.data?<FormDialog id="vehicle-edit-dialog" title={`Edit ${editResult.data.make} ${editResult.data.model}`} closeHref={listHref} size="xl"><VehicleForm vehicle={editResult.data as VehicleRecord} customers={customers??[]} embedded returnTo={`${listHref}&edit=${editResult.data.id}`} {...p}/></FormDialog>:null}
  </main>;
}
