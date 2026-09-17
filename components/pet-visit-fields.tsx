"use client";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { VisitEntityFields } from "@/components/visit-entity-fields";
import { InlineCreationGuard } from "@/components/inline-creation-guard";
import { FormActions } from "@/components/form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAppointmentPet } from "@/app/dashboard/pet-care/actions";
export function PetVisitFields({ pets, owners }: { pets: SelectOption[]; owners: SelectOption[] }) {
 const [choices,setChoices]=useState(pets), [petId,setPetId]=useState("");
 const [draft,setDraft]=useState<{name:string;customer_id:string;species:string}|null>(null), [error,setError]=useState(""), [pending,setPending]=useState(false);
 const requestId=useRef(""),busy=useRef(false);
 function open(name="") {requestId.current=crypto.randomUUID();setDraft({name,customer_id:"",species:"dog"});setError("");}
 async function save() {
  if(busy.current)return;busy.current=true;setPending(true);setError("");
  try{const result=await createAppointmentPet({...draft,requestId:requestId.current});if(result.error){setError(result.error);return;}if(result.data){setChoices(current=>[...current.filter(row=>row.id!==result.data.id),result.data]);setPetId(result.data.id);setDraft(null);}}
  catch{setError("Unable to create the pet. Please try again.");}finally{busy.current=false;setPending(false);}
 }
 return <div className="min-w-0"><label htmlFor="pet-appointment-pet-select" className="text-sm">Pet and owner</label><SearchableSelect id="pet-appointment-pet-select" name="petId" required options={choices} value={petId} onValueChange={setPetId} disabled={draft!==null} placeholder="Search pet or owner name" createLabel="pet" onCreate={open}/>
 {!draft?<Button id="pet-appointment-new-pet-button" type="button" variant="secondary" className="mt-3" onClick={()=>open()}><Plus size={16} aria-hidden="true"/>Add pet and owner</Button>:<InlineCreationGuard><section id="pet-appointment-new-pet" className="mt-3 rounded-ui-lg border border-admin-border bg-admin-surface p-3"><p className="text-sm font-medium">Add this pet to your database?</p><fieldset disabled={pending} className="mt-3 grid gap-3"><VisitEntityFields prefix="pet-appointment" vehiclePrefix="pet-appointment" customerLabel="Owner" customerName="" customers={owners} vehicles={[]} requiresVehicle={false} onCustomerChange={customer_id=>setDraft(current=>current?{...current,customer_id}:current)}/><label className="text-sm">Pet name<Input id="pet-appointment-new-pet-name" value={draft.name} maxLength={120} onChange={event=>setDraft({...draft,name:event.target.value})}/></label><label className="text-sm">Species<select id="pet-appointment-new-pet-species" className="mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-admin-surface px-3" value={draft.species} onChange={event=>setDraft({...draft,species:event.target.value})}>{["dog","cat","other"].map(value=><option key={value} value={value}>{value}</option>)}</select></label>{error?<p role="alert" className="text-sm text-status-danger">{error}</p>:null}<FormActions id="pet-appointment-new-pet-actions" disabled={pending} onCancel={()=>setDraft(null)}><Button id="pet-appointment-new-pet-save" type="button" disabled={pending||!draft.customer_id} onClick={()=>void save()}><Plus size={16} aria-hidden="true"/>{pending?"Saving…":"Add pet"}</Button></FormActions></fieldset></section></InlineCreationGuard>}
 </div>;
}
