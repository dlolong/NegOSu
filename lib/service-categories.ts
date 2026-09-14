import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { categorySchema } from "@/lib/operations";

export type CategoryActionState = { error?: string };
type CategoryActor = { organizationId: string; role: string };
export const categoryEditSchema = categorySchema.extend({
  id: z.union([z.literal(""), z.uuid()]),
  isActive: z.boolean(),
});

export async function writeServiceCategory(db: SupabaseClient, actor: CategoryActor, input: unknown, remove = false): Promise<CategoryActionState> {
  if (!["owner", "manager"].includes(actor.role)) return { error: "Owner or manager access is required." };
  const parsed = remove ? z.object({ id: z.uuid() }).safeParse(input) : categoryEditSchema.safeParse(input);
  if (!parsed.success) return { error: remove ? "Select a valid category." : "Enter a category name (2–100 characters) and a sort order from 0 to 9999." };
  const { id } = parsed.data;
  try {
    let query;
    if (remove) query = db.from("service_categories").delete().eq("id", id).eq("organization_id", actor.organizationId);
    else {
      const value = parsed.data as z.infer<typeof categoryEditSchema>;
      const payload = { organization_id: actor.organizationId, name: value.name, sort_order: value.sortOrder, is_active: value.isActive };
      query = id ? db.from("service_categories").update(payload).eq("id", id).eq("organization_id", actor.organizationId)
        : db.from("service_categories").insert(payload);
    }
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return { error: error.code === "23505" ? "That category already exists." : `Unable to ${remove ? "delete" : "save"} the category. Please try again.` };
    if (!data) return { error: "This category is no longer available. Close this dialog and refresh the list." };
    return {};
  } catch {
    return { error: "Unable to update categories right now. Please try again." };
  }
}

export function servicesCatalogHref({ q, category, tab = "services", dialog, categoryId }: { q?: string; category?: string; tab?: string; dialog?: string; categoryId?: string } = {}) {
  const params = new URLSearchParams();
  if (tab === "categories") params.set("tab", "categories");
  if (q?.trim()) params.set("q", q.trim().slice(0, 100));
  if (category && z.uuid().safeParse(category).success) params.set("category", category);
  if (dialog && ["category-create", "category-edit", "category-delete"].includes(dialog)) params.set("dialog", dialog);
  if (categoryId && z.uuid().safeParse(categoryId).success) params.set("categoryId", categoryId);
  return `/dashboard/services${params.size ? `?${params}` : ""}`;
}
