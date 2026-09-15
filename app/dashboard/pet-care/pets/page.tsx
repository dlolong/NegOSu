import Link from "next/link";
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { Plus, Pencil } from "lucide-react";
import { petContext } from "@/modules/pet-care/runtime";
import type { Pet } from "@/modules/pet-care/pets";
import { PageHeader } from "@/components/page-patterns";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { PetForm } from "@/components/pet-care-forms";
import { Button } from "@/components/ui/button";
import { RecordLink } from "@/components/record-item";
export default async function Page({ searchParams }: { searchParams: Promise<{ dialog?: string; petId?: string; error?: string; q?: string; status?: string; customerId?: string }> }) {
 const [{ db, activeMembership, enabled }, query] = await Promise.all([petContext(), searchParams]);
 const [pets, owners] = await Promise.all([db.from("pet_profiles").select("*").eq("organization_id", activeMembership.organizationId).order("name"), db.from("customers").select("id,full_name").eq("organization_id", activeMembership.organizationId).eq("is_archived", false).order("full_name")]);
 const rows = (pets.data ?? []) as Pet[], ownerName = new Map((owners.data ?? []).map(owner => [owner.id, owner.full_name]));
 const filtered=rows.filter(pet=>(!query.status||query.status==="all"||(query.status==="active"?pet.is_active:!pet.is_active))&&(!query.q||`${pet.name} ${ownerName.get(pet.customer_id)??""}`.toLowerCase().includes(query.q.toLowerCase())));
 const selected = rows.find(pet => pet.id === query.petId), canManage = enabled && ["owner","manager","advisor"].includes(activeMembership.role);
 return <main id="pets-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="pets-header" title="Pets" description="Pet profiles and their primary owners." action={canManage ? <Button id="pet-create-button" asChild><Link href="/dashboard/pet-care/pets?dialog=create"><Plus size={16} aria-hidden="true"/>Add pet</Link></Button> : undefined}/><FormMessage error={query.error ?? (pets.error || owners.error ? "Unable to load pet records." : undefined)}/>
 <ListTabs id="pets-tabs" baseHref="/dashboard/pet-care/pets" query={query} value={query.status??"all"} options={[{value:"all",label:"All",count:rows.length},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
 <RecordTable id="pets-table" className="mt-4" caption="Pet directory" columns={[{key:"pet",label:"Pet"},{key:"owner",label:"Owner",secondary:true},...(canManage?[{key:"status",label:"Status",secondary:true}]:[]),{key:"actions",label:canManage?"Actions":"Status",align:"right"}]} rows={filtered.map(pet=>({id:`pet-row-${pet.id}`,cells:{pet:<><RecordLink id={`pet-link-${pet.id}`} href={`/dashboard/pet-care/pets/${pet.id}`}>{pet.name}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{pet.species} · {pet.breed||"Breed not recorded"}</p></>,owner:ownerName.get(pet.customer_id)??"Pet owner",status:pet.is_active?"Active":"Inactive",actions:canManage?<Button asChild variant="secondary" size="sm"><Link id={`pet-edit-${pet.id}`} href={`/dashboard/pet-care/pets?dialog=edit&petId=${pet.id}`}><Pencil size={16} aria-hidden="true"/>Edit</Link></Button>:pet.is_active?"Active":"Inactive"},mobile:<><p>{ownerName.get(pet.customer_id)??"Pet owner"}</p><p>{pet.is_active?"Active":"Inactive"}</p></>}))}/>
 {!rows.length && !pets.error ? <p className="mt-5 rounded-ui-lg border border-admin-border bg-admin-surface p-5 text-sm text-admin-text-secondary">No pets yet. Add a pet owner in Customers, then add their pet.</p> : null}
 {canManage && (query.dialog === "create" || query.dialog === "edit" && selected) ? <FormDialog id="pet-form-dialog" title={selected ? "Edit pet" : "Add pet"} closeHref="/dashboard/pet-care/pets"><PetForm pet={selected} ownerId={owners.data?.some(owner=>owner.id===query.customerId)?query.customerId:undefined} owners={(owners.data ?? []).map(owner => ({ id: owner.id, name: owner.full_name }))}/></FormDialog> : null}</main>;
}
