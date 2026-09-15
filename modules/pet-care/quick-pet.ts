import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { petSchema } from "@/modules/pet-care/pets";
import type { VisitEntityActor, VisitEntityResult } from "@/lib/visit-entities";
const schema = petSchema.pick({ customer_id: true, name: true, species: true }).extend({ requestId: z.uuid() });
export async function createVisitPet(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<{ id: string; name: string }>> {
  if (actor.industry !== "pet_care" || !["owner", "manager", "advisor"].includes(actor.role)) return { error: "You do not have permission to create pets." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Select an owner and species, and enter the pet name." };
  const value = parsed.data;
  const owner = await db.from("customers").select("id,full_name").eq("id", value.customer_id).eq("organization_id", actor.organizationId).eq("is_archived", false).maybeSingle();
  if (owner.error || !owner.data) return { error: "Select an active owner from this organization." };
  const result = await db.from("pet_profiles").insert({ id: value.requestId, organization_id: actor.organizationId, customer_id: value.customer_id, name: value.name, species: value.species, is_active: true }).select("id,name").single();
  if (!result.error && result.data) return { data: { id: result.data.id, name: `${result.data.name} · ${owner.data.full_name}` } };
  if (result.error?.code === "23505") {
    const existing = await db.from("pet_profiles").select("id,name,customer_id,species").eq("id", value.requestId).eq("organization_id", actor.organizationId).eq("is_active", true).maybeSingle();
    const row = existing.data;
    if (row && row.name === value.name && row.customer_id === value.customer_id && row.species === value.species) return { data: { id: row.id, name: `${row.name} · ${owner.data.full_name}` } };
  }
  return { error: "Unable to create the pet. Please check the details and try again." };
}
