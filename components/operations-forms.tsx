"use client";

import { useState } from "react";

import { Save as SaveIcon } from "lucide-react";

import { SearchableSelect } from "@/components/searchable-select";
import { CategoryField, ServicePicker } from "@/components/catalog-fields";
import { FormActions } from "@/components/form-actions";
import { saveService } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { VisitEntityFields } from "@/components/visit-entity-fields";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDuration, formatMoney } from "@/lib/operations";

const textarea = "mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-admin-text shadow-sm focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-border";
const Field = ({label,children}:{label:string;children:React.ReactNode}) => <label className="block text-sm font-medium text-slate-800">{label}{children}</label>;
export type ServiceRecord={currency?:string;id:string;name:string;category_id:string|null;description:string|null;short_description:string|null;code:string|null;duration_minutes:number;base_price_centavos:number;is_add_on:boolean;parent_service_id:string|null};
type Price={branch_id?:string|null;vehicle_class:string|null;price_centavos:number};

export function ServiceForm({service,categories,branches,services=[],prices,availableBranchIds,error,automotivePricing=true,serviceLabel="Service",idPrefix="service",currency="PHP"}:{currency?:string;service?:ServiceRecord;categories:{id:string;name:string}[];branches:{id:string;name:string}[];services?:{id:string;name:string}[];prices?:Price[];availableBranchIds?:string[];error?:string;automotivePricing?:boolean;serviceLabel?:string;idPrefix?:string}) {
  const priceText=(rows:Price[])=>rows.map(price=>`${price.vehicle_class}=${(price.price_centavos/100).toFixed(2)}`).join("\n");
  return <Card className="p-5 sm:p-7"><FormMessage error={error}/><form id={`${idPrefix}-${service?"edit":"create"}-form`} action={saveService} className="mt-5 grid gap-5 sm:grid-cols-2">
    {service&&<input type="hidden" name="id" value={service.id}/>}<Field label={`${serviceLabel} name *`}><Input id={`${idPrefix}-name-input`} required name="name" maxLength={160} defaultValue={service?.name}/></Field>
    <div><label htmlFor={`${idPrefix}-category-select`} className="text-sm font-medium">Category</label><CategoryField id={`${idPrefix}-category-select`} options={categories} defaultValue={service?.category_id??""}/></div>
    <Field label={`Base price (${service?.currency??currency}) *`}><Input id={`${idPrefix}-base-price-input`} required inputMode="decimal" name="basePrice" defaultValue={service?(service.base_price_centavos/100).toFixed(2):""} placeholder="300.00"/></Field>
    <Field label="Estimated duration (minutes) *"><Input id={`${idPrefix}-duration-input`} required type="number" min={1} max={10080} name="durationMinutes" defaultValue={service?.duration_minutes}/></Field>
    <Field label="Internal code"><Input name="code" maxLength={50} defaultValue={service?.code??""}/></Field>
    <Field label="Add-on compatibility"><SearchableSelect id={`${idPrefix}-parent-service-select`} name="parentServiceId" defaultValue={service?.parent_service_id??""} options={services.filter(candidate=>candidate.id!==service?.id)} placeholder="Any service / standalone"/></Field>
    <div className="sm:col-span-2"><Field label="Short description"><Input name="shortDescription" maxLength={300} defaultValue={service?.short_description??""}/></Field></div>
    <div className="sm:col-span-2"><Field label="Description"><textarea className={textarea} name="description" maxLength={2000} defaultValue={service?.description??""}/></Field></div>
    {automotivePricing?<div className="sm:col-span-2"><Field label="Organization vehicle-class prices"><textarea className={textarea} name="vehiclePrices" placeholder={"sedan=300\nsuv=400\npickup=450"} defaultValue={priceText(prices?.filter(price=>!price.branch_id&&price.vehicle_class)??[])}/></Field><p className="mt-1 text-xs text-zinc-500">Optional. Enter one class=price per line.</p></div>:null}
    {branches.map(branch=>{const base=prices?.find(price=>price.branch_id===branch.id&&!price.vehicle_class);return <fieldset className="rounded-xl border border-zinc-200 p-4 sm:col-span-2" key={branch.id}><legend className="px-1 font-medium">{branch.name} price overrides</legend><div className="grid gap-4 sm:grid-cols-2"><Field label={`Branch base price (${service?.currency??currency})`}><Input inputMode="decimal" name={`branchBasePrice:${branch.id}`} defaultValue={base?(base.price_centavos/100).toFixed(2):""}/></Field>{automotivePricing?<Field label="Vehicle-class overrides"><textarea className={textarea} name={`branchVehiclePrices:${branch.id}`} placeholder={"suv=450\npickup=500"} defaultValue={priceText(prices?.filter(price=>price.branch_id===branch.id&&price.vehicle_class)??[])}/></Field>:null}</div></fieldset>})}
    <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Branch availability</legend><label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" name="allBranches" defaultChecked={!availableBranchIds?.length}/> Available at all branches</label><div className="grid gap-2 sm:grid-cols-2">{branches.map(branch=><label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={availableBranchIds?.includes(branch.id)}/>{branch.name}</label>)}</div></fieldset>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="isAddOn" defaultChecked={service?.is_add_on}/> This is an add-on</label>
    <FormActions id={`${idPrefix}-${service?"edit":"create"}-actions`} cancelHref="/dashboard/services" cancelId={`${idPrefix}-cancel-button`}><SubmitButton id={`${idPrefix}-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save {serviceLabel.toLowerCase()}</SubmitButton></FormActions>
  </form></Card>;
}

type Choice={id:string;name:string}; type VehicleChoice={id:string;customer_id:string;label:string}; type ServiceChoice={currency?:string;id:string;name:string;base_price_centavos:number;duration_minutes:number};
type StaffChoice={id:string;name:string;branchIds:string[]};type ResourceChoice={id:string;name:string;branch_id:string;capacity:number};
export function VisitForm({mode,action,appointment,defaults,branches,customers,vehicles=[],services,staff=[],resources=[],error,canCreateCatalog=false,requiresVehicle=true,customerLabel="Customer",serviceLabel="Service",resourceLabel="Service bay",currency="PHP",idPrefix,requestId}:{mode:"appointment"|"walk_in";action:(data:FormData)=>void|Promise<void|{error:string}>;requestId?:string;appointment?:{id:string;branch_id:string;customer_id:string;vehicle_id:string|null;starts_at:string;customer_note:string|null;internal_note:string|null;serviceIds:string[];staffIds?:string[];resourceIds?:string[]};defaults?:{customerId?:string;vehicleId?:string;serviceId?:string;branchId?:string;maintenanceDueId?:string};branches:Choice[];customers:Choice[];vehicles?:VehicleChoice[];services:ServiceChoice[];staff?:StaffChoice[];resources?:ResourceChoice[];error?:string;canCreateCatalog?:boolean;customerQ?:string;requiresVehicle?:boolean;customerLabel?:string;serviceLabel?:string;resourceLabel?:string;currency?:string;idPrefix?:string}) {
  const [saveError,setSaveError] = useState<string>();
  const initialBranch = appointment?.branch_id??defaults?.branchId??branches[0]?.id;
  const [branchId,setBranchId] = useState(initialBranch);
  const controlPrefix=idPrefix??mode,formId=idPrefix?`${idPrefix}-${appointment?"edit":"create"}-form`:mode==="walk_in"?"walk-in-create-form":appointment?"appointment-edit-form":"appointment-create-form";
  return <div onResetCapture={event=>{event.preventDefault();event.stopPropagation();}}><Card className="p-5 sm:p-7"><FormMessage id={`${controlPrefix}-error`} error={saveError??error}/><form id={formId} action={async data=>{setSaveError(undefined);const result=await action(data);if(result)setSaveError(result.error);}} className="mt-5 grid gap-5 sm:grid-cols-2">
    {requestId?<input type="hidden" name="requestId" value={requestId}/>:null}
    {mode==="walk_in"?<p className="sm:col-span-2 text-sm text-admin-text-secondary">Check in an arriving client now. Services must fit within branch hours and available staff and resources.</p>:null}
    {appointment&&<input type="hidden" name="appointmentId" value={appointment.id}/>} {defaults?.maintenanceDueId?<input type="hidden" name="maintenanceDueId" value={defaults.maintenanceDueId}/>:null}<Field label="Branch *"><SearchableSelect id={`${controlPrefix}-branch-select`} required name="branchId" value={branchId} onValueChange={setBranchId} options={branches}/></Field>
    <VisitEntityFields prefix={controlPrefix} vehiclePrefix={mode} customers={customers} vehicles={vehicles} customerLabel={customerLabel} requiresVehicle={requiresVehicle} defaultCustomerId={appointment?.customer_id??defaults?.customerId} defaultVehicleId={appointment?.vehicle_id??defaults?.vehicleId??undefined}/>
    {mode==="appointment"&&<><Field label="Date and time *"><Input id={`${controlPrefix}-starts-at-input`} required type="datetime-local" name="startsAt" defaultValue={appointment?.starts_at}/></Field><label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input id={`${controlPrefix}-allow-conflict-checkbox`} type="checkbox" name="acceptConflict"/> Allow an overlapping booking after reviewing the schedule</label></>}
    {(mode==="appointment"||!requiresVehicle)&&<><Field label="Assigned staff"><SearchableSelect key={`staff-${branchId}`} id={`${controlPrefix}-staff-select`} name="staffIds" defaultValue={branchId===initialBranch?appointment?.staffIds?.[0]??"":""} options={staff.filter(member=>!member.branchIds.length||member.branchIds.includes(branchId))} placeholder="Search staff or leave unassigned"/></Field><Field label={resourceLabel}><SearchableSelect key={`resource-${branchId}`} id={`${controlPrefix}-resource-select`} name="resourceIds" defaultValue={branchId===initialBranch?appointment?.resourceIds?.[0]??"":""} options={resources.filter(resource=>resource.branch_id===branchId).map(resource=>({...resource,description:`Capacity ${resource.capacity}`}))} placeholder="Search resources or leave unassigned"/></Field></>}
    <ServicePicker currency={currency} id={controlPrefix} label={serviceLabel} services={services.map(service=>({...service,description:`From ${formatMoney(service.base_price_centavos,service.currency)} · ${formatDuration(service.duration_minutes)}`}))} defaultIds={appointment?.serviceIds??(defaults?.serviceId?[defaults.serviceId]:[])} canCreate={canCreateCatalog}/>
    <div className="sm:col-span-2"><Field label={mode==="appointment"?`${customerLabel} notes`:"Walk-in notes"}><textarea id={`${controlPrefix}-customer-notes-input`} className={textarea} name={mode==="appointment"?"customerNote":"notes"} defaultValue={appointment?.customer_note??""}/></Field></div>
    {mode==="appointment"&&<div className="sm:col-span-2"><Field label="Internal notes"><textarea id={`${controlPrefix}-internal-notes-input`} className={textarea} name="internalNote" defaultValue={appointment?.internal_note??""}/></Field></div>}
    <FormActions id={`${controlPrefix}-form-actions`} cancelHref={mode === "walk_in" ? (requiresVehicle?"/dashboard/queue":"/dashboard/appointments") : appointment ? `/dashboard/appointments/${appointment.id}` : "/dashboard/appointments"} cancelId={`${controlPrefix}-cancel-button`}><SubmitButton id={`${controlPrefix}-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>{appointment ? "Save appointment" : mode === "appointment" ? "Book appointment" : requiresVehicle ? "Add to queue" : "Add walk-in"}</SubmitButton></FormActions>
  </form></Card></div>;
}
