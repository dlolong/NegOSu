import { SearchableSelect } from "@/components/searchable-select";

import { Save as SaveIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { FormDialog } from "@/components/management-ui";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { saveSchedulingResource } from "../../actions";

export default async function EditSchedulingResourcePage({ params }: { params: Promise<{ resourceId: string }> }) {
  const [{ resourceId }, { activeMembership }, supabase] = await Promise.all([params, getDashboardContext(), createClient()]);
  const salon = activeMembership.industry === "salon";
  const prefix = salon ? "salon-resource" : "scheduling-resource";
  const { data: resource } = await supabase.from("scheduling_resources").select("id,name,branch_id,resource_type,capacity").eq("id", resourceId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (!resource || !["owner", "manager"].includes(activeMembership.role)) notFound();
  const form=<Card className="p-5"><form id={`${prefix}-edit-form`} action={saveSchedulingResource} className="grid gap-4 sm:grid-cols-2"><input name="id" type="hidden" value={resource.id}/><label className="text-sm font-medium">Name<Input id={`${prefix}-edit-name-input`} required name="name" defaultValue={resource.name} maxLength={120} className="mt-2"/></label><label className="text-sm font-medium">Branch<SearchableSelect id={`${prefix}-edit-branch-select`} required name="branchId" defaultValue={resource.branch_id} options={activeMembership.branches} placeholder="Search branch"/></label><label className="text-sm font-medium">Type<select id={`${prefix}-edit-type-select`} name="resourceType" defaultValue={resource.resource_type} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3">{!salon&&<option value="bay">Bay</option>}<option value="station">Station</option><option value="room">Room</option><option value="equipment">Equipment</option><option value="other">Other</option></select></label><label className="text-sm font-medium">Capacity<Input id={`${prefix}-edit-capacity-input`} required name="capacity" type="number" min={1} max={100} defaultValue={resource.capacity} className="mt-2"/></label><FormActions id={`${prefix}-edit-actions`} cancelHref="/dashboard/settings/resources"><SubmitButton id={`${prefix}-edit-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save changes</SubmitButton></FormActions></form></Card>;
  if(salon) return <main id="salon-resource-edit-page"><FormDialog id="salon-resource-edit-dialog" title="Edit station or resource" closeHref="/dashboard/settings/resources">{form}</FormDialog></main>;
  return <div id="scheduling-resource-edit-page" className="mx-auto max-w-3xl"><p className="text-sm font-medium text-brand-primary">Settings</p><h1 className="mt-1 text-3xl font-medium">Edit service bay</h1><div className="mt-6">{form}</div></div>;
}
