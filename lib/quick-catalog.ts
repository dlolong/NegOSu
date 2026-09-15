import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { categorySchema, serviceSchema, parseMoneyToCentavos } from "@/lib/operations";
import type { VisitEntityActor, VisitEntityResult } from "@/lib/visit-entities";
import type { RecordChoice } from "@/lib/record-lookup";
export const quickCategorySchema = categorySchema.pick({ name: true }).extend({ requestId: z.uuid() });
export const quickServiceSchema = serviceSchema.pick({ name: true, categoryId: true, basePrice: true, durationMinutes: true }).extend({ requestId: z.uuid(), basePrice: z.string().max(32) });
export async function createQuickCategory(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<RecordChoice>> {
  if (!["owner", "manager"].includes(actor.role)) return { error: "Owner or manager access is required to add categories." };
  const parsed = quickCategorySchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a category name of 2–100 characters." };
  const { requestId, name } = parsed.data;
  const result = await db.from("service_categories").insert({ id: requestId, organization_id: actor.organizationId, name, sort_order: 0, is_active: true }).select("id,name").single();
  if (!result.error && result.data) return { data: result.data };
  if (result.error?.code === "23505") {
    const existing = await db.from("service_categories").select("id,name").eq("id", requestId).eq("organization_id", actor.organizationId).eq("is_active", true).maybeSingle();
    if (existing.data?.name === name) return { data: existing.data };
    return { error: "That category already exists. Select it from search, or reactivate it in Services if it is inactive." };
  }
  return { error: "Unable to create the category. Please try again." };
}
export async function createQuickService(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<RecordChoice>> {
  if (!["owner", "manager"].includes(actor.role)) return { error: "Owner or manager access is required to add services." };
  const parsed = quickServiceSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a service name, valid category, and duration from 1 to 10080 minutes." };
  const value = parsed.data, amount = parseMoneyToCentavos(value.basePrice);
  if (amount === null || amount > 100000000000n) return { error: "Enter a nonnegative price with up to two decimal places." };
  if (value.categoryId) {
    const category = await db.from("service_categories").select("id").eq("id", value.categoryId).eq("organization_id", actor.organizationId).eq("is_active", true).maybeSingle();
    if (category.error || !category.data) return { error: "Select an active category from this organization." };
  }
  const payload = { id: value.requestId, organization_id: actor.organizationId, name: value.name, category_id: value.categoryId, base_price_centavos: Number(amount), duration_minutes: value.durationMinutes, is_active: true, is_add_on: false };
  const result = await db.from("services").insert(payload).select("id,name").single();
  if (!result.error && result.data) return { data: { ...result.data, description: `PHP ${(Number(amount) / 100).toFixed(2)} · ${value.durationMinutes} min` } };
  if (result.error?.code === "23505") {
    const existing = await db.from("services").select("id,name,category_id,base_price_centavos,duration_minutes").eq("id", value.requestId).eq("organization_id", actor.organizationId).eq("is_active", true).maybeSingle();
    const row = existing.data;
    if (row && row.name === value.name && row.category_id === value.categoryId && row.base_price_centavos === Number(amount) && row.duration_minutes === value.durationMinutes) return { data: { id: row.id, name: row.name } };
    return { error: "That service already exists. Select it from search, or reactivate it in Services if it is inactive." };
  }
  return { error: "Unable to create the service. Please try again." };
}
