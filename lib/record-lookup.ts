import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { VisitEntityActor, VisitEntityResult } from "@/lib/visit-entities";
export type RecordKind = "customer" | "vehicle" | "service" | "category";
export type RecordChoice = { id: string; name: string; keywords?: string; description?: string };
const schema = z.object({ kind: z.enum(["customer", "vehicle", "service", "category"]), query: z.string().trim().max(160), scopeId: z.uuid().optional() });
export async function searchRecords(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<RecordChoice[]>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid search." };
  const { kind, query, scopeId } = parsed.data;
  const terms = query.replace(/[,%()\\_"]/g, " ").split(/\s+/).filter(Boolean).slice(0, 12);
  if (kind === "customer") {
    let request = db.from("customers").select("id,full_name,phone,email").eq("organization_id", actor.organizationId).eq("is_archived", false);
    for (const term of terms) request = request.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    const result = await request.order("full_name").limit(50);
    if (result.error) return { error: "Unable to search customers. Please try again." };
    return { data: (result.data ?? []).map(row => ({ id: row.id, name: row.full_name, keywords: `${row.phone ?? ""} ${row.email ?? ""}`, description: [row.phone, row.email].filter(Boolean).join(" · ") })) };
  }
  if (kind === "vehicle") {
    if (actor.industry !== "automotive" || !scopeId) return { data: [] };
    let request = db.from("vehicles").select("id,make,model,plate_number").eq("organization_id", actor.organizationId).eq("customer_id", scopeId).eq("is_archived", false);
    for (const term of terms) request = request.or(`make.ilike.%${term}%,model.ilike.%${term}%,plate_number.ilike.%${term}%`);
    const result = await request.order("make").limit(50);
    if (result.error) return { error: "Unable to search vehicles. Please try again." };
    return { data: (result.data ?? []).map(row => ({ id: row.id, name: [row.make, row.model, row.plate_number].filter(Boolean).join(" · ") })) };
  }
  if (kind === "category") {
    let request = db.from("service_categories").select("id,name").eq("organization_id", actor.organizationId).eq("is_active", true);
    for (const term of terms) request = request.ilike("name", `%${term}%`);
    const result = await request.order("name").limit(50);
    return result.error ? { error: "Unable to search categories. Please try again." } : { data: result.data ?? [] };
  }
  // Include category matches without relying on the limited initial service list.
  let categoryQuery = db.from("service_categories").select("id").eq("organization_id", actor.organizationId);
  for (const term of terms) categoryQuery = categoryQuery.ilike("name", `%${term}%`);
  const categories = await categoryQuery.limit(100);
  if (categories.error) return { error: "Unable to search service categories. Please try again." };
  let request = db.from("services").select("id,name,base_price_centavos,duration_minutes,service_categories(name)").eq("organization_id", actor.organizationId).eq("is_active", true);
  const categoryIds = (categories.data ?? []).map(row => row.id);
  for (const term of terms) request = request.or(`name.ilike.%${term}%${categoryIds.length ? `,category_id.in.(${categoryIds.join(",")})` : ""}`);
  const result = await request.order("name").limit(50);
  if (result.error) return { error: "Unable to search services. Please try again." };
  return { data: (result.data ?? []).map(row => {
    const category = Array.isArray(row.service_categories) ? row.service_categories[0] : row.service_categories;
    return { id: row.id, name: row.name, keywords: category?.name ?? "", description: `${category?.name ? `${category.name} · ` : ""}PHP ${(row.base_price_centavos / 100).toFixed(2)} · ${row.duration_minutes} min` };
  }) };
}
