"use client";
import { useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Plus, Save } from "lucide-react";
import { saveAppointmentWalkIn } from "@/app/dashboard/appointments/walk-in-actions";
import { savePet, savePetAppointment } from "@/app/dashboard/pet-care/actions";
import { PetVisitFields } from "@/components/pet-visit-fields";
import { SearchableSelect } from "@/components/searchable-select";
import { ServicePicker } from "@/components/catalog-fields";
import { VisitEntityFields } from "@/components/visit-entity-fields";
import { FormActions } from "@/components/form-actions";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import type { Pet } from "@/modules/pet-care/pets";
type Option = { id: string; name: string };
const select = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3";
export function PetForm({ pet, owners, ownerId }: { pet?: Pet; owners: Option[]; ownerId?: string }) {
  return <form id="pet-form" action={savePet} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={pet?.id ?? ""}/>
    <div className="col-span-full"><VisitEntityFields prefix="pet" vehiclePrefix="pet" customerLabel="Owner" customerName="customer_id" selectId="pet-owner-select" requiresVehicle={false} vehicles={[]} customers={owners} defaultCustomerId={pet?.customer_id??ownerId}/></div>
    <label className="text-sm">Pet name<Input id="pet-name-input" name="name" required maxLength={120} defaultValue={pet?.name} className="mt-2"/></label>
    <label className="text-sm">Species<select id="pet-species-select" name="species" defaultValue={pet?.species ?? "dog"} className={select}>{["dog", "cat", "other"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="text-sm">Breed (optional)<Input id="pet-breed-input" name="breed" maxLength={120} defaultValue={pet?.breed ?? ""} className="mt-2"/></label>
    <label className="text-sm">Date of birth (optional)<Input id="pet-birth-input" name="date_of_birth" type="date" defaultValue={pet?.date_of_birth ?? ""} className="mt-2"/></label>
    <label className="text-sm">Size (optional)<select id="pet-size-select" name="size_category" defaultValue={pet?.size_category ?? ""} className={select}><option value="">Not recorded</option>{["small", "medium", "large", "extra_large"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
    <label className="text-sm">Status<select id="pet-active-select" name="is_active" defaultValue={String(pet?.is_active ?? true)} className={select}><option value="true">Active</option><option value="false">Inactive</option></select></label>
    <details id="pet-preferences" className="col-span-full rounded-xl border border-admin-border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm">Coat, grooming preferences, and handling information</summary>{[["coat", "Coat information", 300], ["grooming_preferences", "Grooming preferences", 1000], ["handling_cautions", "Owner-reported handling cautions", 1000]].map(([name,label,max]) => <label key={String(name)} className="mt-3 block text-sm">{label}<textarea id={`pet-${name}-input`} name={String(name)} maxLength={Number(max)} defaultValue={pet?.[name as "coat" | "grooming_preferences" | "handling_cautions"] ?? ""} className="mt-2 min-h-24 w-full rounded-xl border border-admin-border p-3"/></label>)}<p className="mt-2 text-xs text-admin-text-secondary">Recorded owner information, not professionally verified. Handling cautions are internal and are excluded from customer links.</p></details>
    <FormActions id="pet-form-actions" cancelHref="/dashboard/pet-care/pets"><SubmitButton id="pet-save-button" pendingText="Saving…"><Save size={16} aria-hidden="true"/>Save pet</SubmitButton></FormActions>
  </form>;
}
export function PetAppointmentForm({ pets, owners, services, staff, resources, timezone, openingHours = {}, canCreateCatalog = false, walkIn = false, requestId }: { walkIn?:boolean; requestId?:string; pets: Option[]; owners: Option[]; services: Option[]; staff: Option[]; resources: Option[]; timezone: string; openingHours?: Record<string, {open?:string;close?:string;closed?:boolean}>; canCreateCatalog?: boolean }) {
  const [error, setError] = useState<string>();
  return <div onResetCapture={event => { event.preventDefault(); event.stopPropagation(); }}><FormMessage id="pet-appointment-error" error={error}/><form id="pet-appointment-form" action={async data => { setError(undefined); const result = await (walkIn ? saveAppointmentWalkIn(data) : savePetAppointment(data)); setError(result.error); }} className="grid min-w-0 grid-cols-1 gap-4">
    {requestId?<input type="hidden" name="requestId" value={requestId}/>:null}
    <PetVisitFields pets={pets} owners={owners}/>
    {walkIn?<p className="text-sm text-admin-text-secondary">Check in an arriving pet now. Grooming must fit within branch hours and the selected groomer and resource availability.</p>:<label className="text-sm">Appointment time ({timezone})<Input id="pet-appointment-time-input" name="startsAt" type="datetime-local" required className="mt-2"/></label>}
    <details id="pet-appointment-branch-hours" className="rounded-ui-md border border-admin-border p-3"><summary className="cursor-pointer text-sm font-medium">Branch hours ({timezone})</summary><p className="mt-2 text-xs text-admin-text-secondary">The complete service duration must fit within opening hours.</p><dl className="mt-2 grid gap-1 text-sm">{["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(day => { const hours = openingHours[day]; return <div key={day} className="flex justify-between gap-3"><dt className="capitalize">{day}</dt><dd>{!hours || hours.closed || !hours.open || !hours.close ? "Closed / not configured" : `${hours.open}–${hours.close}`}</dd></div>; })}</dl></details>
    <ServicePicker id="pet-appointment" services={services} canCreate={canCreateCatalog}/>
    <label className="text-sm">Groomer<SearchableSelect id="pet-appointment-staff-select" name="staffIds" required options={staff} placeholder="Search assigned staff"/></label>
    <label className="text-sm">Grooming resource<SearchableSelect id="pet-appointment-resource-select" name="resourceIds" required options={resources} placeholder="Search grooming resources"/></label>
    <p className="text-xs text-admin-text-secondary">One pet per appointment. Staff and resources reserve the complete service duration.</p>
    <FormActions id="pet-appointment-actions" cancelHref="/dashboard/pet-care/appointments"><SubmitButton id="pet-appointment-save-button" pendingText={walkIn?"Adding…":"Booking…"}><Plus size={16} aria-hidden="true"/>{walkIn?"Add walk-in":"Book appointment"}</SubmitButton></FormActions>
  </form></div>;
}
