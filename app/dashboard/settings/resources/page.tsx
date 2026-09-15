import { SearchableSelect } from "@/components/searchable-select";

import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";

import { Pencil as PencilIcon, Plus as PlusIcon, Power as PowerIcon, Save as SaveIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import Link from "next/link";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { saveSchedulingResource, toggleSchedulingResource } from "./actions";

type ResourceRow={id:string;name:string;branch_id:string;resource_type:string;capacity:number;is_active:boolean;branches:{name:string}|{name:string}[]|null};
type Branch={id:string;name:string};
const branchName=(resource:ResourceRow)=>{const branch=Array.isArray(resource.branches)?resource.branches[0]:resource.branches;return branch?.name??"Unknown branch";};

export default async function SchedulingResourcesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; create?: string; resourceId?: string; status?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const salon = activeMembership.industry !== "automotive",prefix = salon ? "salon-resource" : "scheduling-resource";
  const { data, error } = await supabase.from("scheduling_resources").select("id,name,branch_id,resource_type,capacity,is_active,branches(name)").eq("organization_id", activeMembership.organizationId).order("name");
  const resources=(data??[]) as unknown as ResourceRow[],canManage=["owner","manager"].includes(activeMembership.role);
  const selected=resources.find(resource=>resource.id===params.resourceId);
  const branches=activeMembership.branches.map(({id,name})=>({id,name}));
  const form=<ResourceForm branches={branches} prefix={prefix} salon={salon}/>;
  return <main id={salon ? "salon-resources-page" : "scheduling-resources-page"} className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id={salon ? "salon-resources-page-header" : "scheduling-resources-page-header"} eyebrow="Settings" title={salon ? "Stations and resources" : "Service bays and resources"} description={salon ? "Manage stations, rooms, and equipment reserved for appointments." : "Manage the bays, stations, rooms, or equipment reserved for appointments."} action={canManage?<Button asChild><Link id={`${prefix}-create-button`} href="/dashboard/settings/resources?create=1"><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Add resource</Link></Button>:undefined}/>
    <FormMessage {...params} error={params.error??(error?"Unable to load scheduling resources.":undefined)}/>
    <ListTabs id="resources-tabs" baseHref="/dashboard/settings/resources" query={params} value={params.status??"all"} options={[{value:"all",label:"All",count:resources.length},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
    <ResourceViews resources={resources.filter(resource=>!params.status||params.status==="all"||(params.status==="active"?resource.is_active:!resource.is_active))} canManage={canManage} salon={salon}/>
    {!resources.length&&<Card id={`${prefix}s-empty-state`} className="mt-6 p-8 text-center text-zinc-600">{salon?"No stations, rooms, or equipment yet.":"No service bays or scheduling resources yet."}</Card>}
    {canManage&&params.create?<FormDialog id={`${prefix}-create-dialog`} title="Add station or resource" closeHref="/dashboard/settings/resources">{form}</FormDialog>:null}
    {selected ? <FormDialog id={`${prefix}-details-dialog`} title={selected.name} closeHref="/dashboard/settings/resources" size="md"><dl className="grid grid-cols-2 gap-4 text-sm">{[["Branch", branchName(selected)], ["Type", selected.resource_type], ["Capacity", selected.capacity], ["Status", selected.is_active ? "Active" : "Inactive"]].map(([label,value])=><div key={label}><dt className="text-admin-text-muted">{label}</dt><dd className="[overflow-wrap:anywhere]">{value}</dd></div>)}</dl></FormDialog> : null}
  </main>;
}

function ResourceForm({branches,prefix,salon}:{branches:Branch[];prefix:string;salon:boolean}) { return <form id={`${prefix}-form`} action={saveSchedulingResource} className="mt-4 grid gap-4 sm:grid-cols-2"><input name="id" type="hidden" value=""/><label className="text-sm font-semibold">Name<Input id={`${prefix}-name-input`} required name="name" maxLength={120} className="mt-2"/></label><label className="text-sm font-semibold">Branch<SearchableSelect id={`${prefix}-branch-select`} required name="branchId" defaultValue={branches[0]?.id} options={branches} placeholder="Search branch"/></label><label className="text-sm font-semibold">Type<select id={`${prefix}-type-select`} name="resourceType" defaultValue={salon?"station":"bay"} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3">{!salon&&<option value="bay">Bay</option>}<option value="station">Station</option><option value="room">Room</option><option value="equipment">Equipment</option><option value="other">Other</option></select></label><label className="text-sm font-semibold">Capacity<Input id={`${prefix}-capacity-input`} required name="capacity" type="number" min={1} max={100} defaultValue={1} className="mt-2"/></label><FormActions id={`${prefix}-actions`} cancelHref="/dashboard/settings/resources"><SubmitButton id={`${prefix}-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save resource</SubmitButton></FormActions></form>; }

function ResourceViews({resources,canManage,salon}:{resources:ResourceRow[];canManage:boolean;salon:boolean}) {
 const prefix=salon?"salon-resource":"scheduling-resource";
 return <RecordTable id={salon?"salon-resources-table":"scheduling-resources-table"} className="mt-4" caption="Scheduling resources" columns={[{key:"resource",label:"Resource"},{key:"branch",label:"Branch",secondary:true},{key:"capacity",label:"Capacity",secondary:true},...(canManage?[{key:"status",label:"Status",secondary:true}]:[]),{key:"actions",label:canManage?"Actions":"Status",align:"right"}]} rows={resources.map(resource=>({id:`${prefix}-row-${resource.id}`,cells:{resource:<><RecordLink id={`${prefix}-link-${resource.id}`} href={canManage?`/dashboard/settings/resources/${resource.id}/edit`:`/dashboard/settings/resources?resourceId=${resource.id}`}>{resource.name}</RecordLink><p className="mt-1 text-xs capitalize text-admin-text-secondary">{resource.resource_type}</p></>,branch:branchName(resource),capacity:resource.capacity,status:resource.is_active?"Active":"Inactive",actions:canManage?<ResourceActions resource={resource} context="desktop" prefix={prefix}/>:resource.is_active?"Active":"Inactive"},mobile:<><p>{branchName(resource)} · Capacity {resource.capacity}</p><p>{resource.is_active?"Active":"Inactive"}</p></>}))}/>;
}

function ResourceActions({resource,context,prefix}:{resource:ResourceRow;context:string;prefix:"salon-resource"|"scheduling-resource"}) { return <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2"><Button asChild variant="secondary" size="sm"><Link id={`${prefix}-${resource.id}-edit-${context}`} href={`/dashboard/settings/resources/${resource.id}/edit`}><PencilIcon aria-hidden="true" size={16} className="shrink-0"/>Edit</Link></Button><form id={`${prefix}-${resource.id}-toggle-form-${context}`} action={toggleSchedulingResource}><input type="hidden" name="id" value={resource.id}/><input type="hidden" name="active" value={String(!resource.is_active)}/><SubmitButton id={`${prefix}-${resource.id}-toggle-${context}`} variant={resource.is_active?"destructive":"secondary"} pendingText="Updating…" size="sm"><PowerIcon aria-hidden="true" size={16} className="shrink-0"/>{resource.is_active?"Deactivate":"Activate"}</SubmitButton></form></div>; }
