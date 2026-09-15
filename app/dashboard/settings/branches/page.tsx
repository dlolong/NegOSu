import { FormDialog } from "@/components/management-ui";

import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";

import { Pencil as PencilIcon, Plus as PlusIcon, Power as PowerIcon, Star as StarIcon } from "lucide-react";
import Link from "next/link";

import { setPrimaryBranch, toggleBranch } from "@/app/dashboard/crm-actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string; branchId?: string; status?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const { data, error } = await supabase.from("branches")
    .select("id,name,address_line,barangay,city,province,is_active,is_primary,phone,email")
    .eq("organization_id", activeMembership.organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at");
  const selected = data?.find(branch => branch.id === params.branchId);
  const canManage = ["owner", "manager"].includes(activeMembership.role);

  return <main id="branches-page" className="mx-auto min-w-0 max-w-5xl">
    <PageHeader id="branches-page-header" eyebrow="Settings" title="Branches" description="Manage locations and the organization default." action={canManage ? <Button asChild><Link id="branch-create-button" href="/dashboard/settings/branches/new"><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Add branch</Link></Button> : undefined}/>
    <FormMessage {...params} error={params.error ?? (error ? "Unable to load branches." : undefined)}/>
    <ListTabs id="branches-tabs" baseHref="/dashboard/settings/branches" query={params} value={params.status??"all"} options={[{value:"all",label:"All",count:data?.length??0},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
    <section id="branches-list" className="mt-4"><RecordTable id="branches-table" caption="Business branches" columns={[{key:"branch",label:"Branch"},{key:"contact",label:"Contact",secondary:true},...(canManage?[{key:"status",label:"Status",secondary:true}]:[]),{key:"actions",label:canManage?"Actions":"Status",align:"right"}]} rows={(data??[]).filter(branch=>!params.status||params.status==="all"||(params.status==="active"?branch.is_active:!branch.is_active)).map(branch=>({id:`branch-card-${branch.id}`,cells:{
      branch:<><RecordLink id={`branch-link-${branch.id}`} href={canManage?`/dashboard/settings/branches/${branch.id}/edit`:`/dashboard/settings/branches?branchId=${branch.id}`}>{branch.name}</RecordLink>{branch.is_primary&&<span className="ml-2 text-xs text-brand-primary">Default</span>}<p className="mt-1 text-xs text-admin-text-secondary">{[branch.address_line,branch.barangay,branch.city,branch.province].filter(Boolean).join(", ")}</p></>,contact:branch.phone||branch.email||"No contact details",status:branch.is_active?"Active":"Inactive",actions:canManage ? <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2">
            <Button id={`branch-edit-button-${branch.id}`} asChild variant="secondary" size="sm"><Link href={`/dashboard/settings/branches/${branch.id}/edit`}><PencilIcon aria-hidden="true" size={16} className="shrink-0"/>Edit</Link></Button>
            {branch.is_active && !branch.is_primary ? <form id={`branch-default-form-${branch.id}`} action={setPrimaryBranch}><input type="hidden" name="id" value={branch.id}/><SubmitButton id={`branch-default-button-${branch.id}`} variant="secondary" pendingText="Updating…" size="sm"><StarIcon aria-hidden="true" size={16} className="shrink-0"/>Make default</SubmitButton></form> : null}
            <form id={`branch-toggle-form-${branch.id}`} action={toggleBranch}><input type="hidden" name="id" value={branch.id}/><input type="hidden" name="active" value={String(!branch.is_active)}/><SubmitButton id={`branch-toggle-button-${branch.id}`} variant={branch.is_active ? "destructive" : "secondary"} pendingText="Updating…" size="sm"><PowerIcon aria-hidden="true" size={16} className="shrink-0"/>{branch.is_active ? "Deactivate" : "Activate"}</SubmitButton></form>
          </div> : null
    },mobile:<><p>{branch.phone||branch.email||"No contact details"}</p><p>{branch.is_active?"Active":"Inactive"}</p></>}))}/></section>
    {selected ? <FormDialog id="branch-details-dialog" title={selected.name} closeHref="/dashboard/settings/branches" size="md"><dl className="space-y-4 text-sm"><div><dt className="text-admin-text-muted">Address</dt><dd className="[overflow-wrap:anywhere]">{[selected.address_line, selected.barangay, selected.city, selected.province].filter(Boolean).join(", ") || "Not provided"}</dd></div><div><dt className="text-admin-text-muted">Contact</dt><dd className="[overflow-wrap:anywhere]">{selected.phone || selected.email || "Not provided"}</dd></div><div><dt className="text-admin-text-muted">Status</dt><dd>{selected.is_active ? "Active" : "Inactive"}</dd></div></dl></FormDialog> : null}
  </main>;
}
