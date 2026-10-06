import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { businessLogoUrlSchema } from "@/modules/platform/business-branding";

export const catalogPhotoSchema = z.object({
  kind: z.enum(["product", "promo", "service"]), id: z.uuid(), url: businessLogoUrlSchema,
  previousUrl: businessLogoUrlSchema.nullable(),
});
export async function updateCatalogPhoto(db: SupabaseClient, actor: { role: string; organizationId: string; branchId: string; industry: string }, input: unknown): Promise<{ error?: string }> {
  if (!["owner", "manager"].includes(actor.role)) return { error: "Catalog management access required." };
  if (!["automotive", "salon", "pet_care", "hospitality"].includes(actor.industry)) return { error: "Catalog unavailable." };
  const parsed = catalogPhotoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the photo details." };
  const { kind, id, url, previousUrl } = parsed.data;
  const unavailable = { error: "This photo changed or the record is unavailable. Refresh and try again." };
  try {
    if (kind === "promo") {
      const { data: promo, error } = await db.from("commerce_promos").select("id,name,description,price_centavos,status,version,valid_from,valid_through,components,image_url,is_public")
        .eq("id", id).eq("organization_id", actor.organizationId).eq("branch_id", actor.branchId).maybeSingle();
      if (error || !promo || (promo.image_url || "") !== (previousUrl || "")) return unavailable;
      if ((promo.image_url || "") === url) return {};
      // Reuse authoritative promo validation and version checking; other fields come from the database.
      const saved = await db.rpc("save_commerce_promo_details", {
        p_org: actor.organizationId, p_branch: actor.branchId, p_id: id, p_version: promo.version,
        p_name: promo.name, p_description: promo.description, p_price: promo.price_centavos,
        p_status: promo.status, p_from: promo.valid_from, p_through: promo.valid_through,
        p_components: promo.components, p_is_public: promo.is_public, p_image_url: url || null, p_request: crypto.randomUUID(),
      });
      return saved.error ? { error: "Unable to save the promo photo. Refresh and try again." } : {};
    }
    // Change only the photo, and compare the prior value to avoid overwriting another photo edit.
    let update = db.from(kind === "product" ? "inventory_items" : "services").update({ thumbnail_url: url || null }).eq("id", id).eq("organization_id", actor.organizationId);
    if (kind === "product") update = update.eq("branch_id", actor.branchId);
    update = previousUrl === null ? update.is("thumbnail_url", null) : update.eq("thumbnail_url", previousUrl);
    const { data, error } = await update.select("id").maybeSingle();
    return error || !data ? unavailable : {};
  } catch { return { error: "Unable to save the photo. Please try again." }; }
}
