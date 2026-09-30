"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogPrice } from "@/modules/core/commerce/pricing";
import { promoSchema } from "@/modules/core/commerce/promos";
import { catalogSaveError } from "@/modules/core/commerce/save-errors";

export type CatalogActionState = { error?: string };
export async function savePromo(_previous: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const { activeMembership: m } = await getDashboardContext();
  if (!["owner", "manager"].includes(m.role)) return { error: "Promo management access required." };
  let components: unknown;
  try { components = JSON.parse(String(form.get("components"))); } catch { return { error: "Choose valid promo components." }; }
  if (parseCatalogPrice(String(form.get("price"))) === null) return { error: "Enter a valid price from 0 to 100,000,000 with no more than two decimal places." };
  const parsed = promoSchema.safeParse({ imageUrl:form.get("imageUrl")??"",isPublic:form.get("isPublic")==="on",name: form.get("name"), description: form.get("description"), priceCentavos: parseCatalogPrice(String(form.get("price"))), status: form.get("status"), validFrom: form.get("validFrom") || null, validThrough: form.get("validThrough") || null, components });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check promo details." };
  const id = form.get("id") || null;
  if (id && !z.uuid().safeParse(id).success) return { error: "Promo unavailable." };
  const value = parsed.data;
  if (!z.uuid().safeParse(form.get("requestKey")).success) return { error: "Reload this form before saving." };
  const db = await createClient();
  const { error } = await db.rpc("save_commerce_promo_details", { p_image_url:value.imageUrl||null,p_is_public:value.isPublic, p_request: form.get("requestKey"), p_org: m.organizationId, p_branch: m.branchId, p_id: id, p_version: Number(form.get("version") || 0), p_name: value.name, p_description: value.description, p_price: value.priceCentavos, p_status: value.status, p_from: value.validFrom, p_through: value.validThrough, p_components: value.components });
  if (error?.code === "PGRST202" || error?.code === "42703") return { error: "Promo images and public booking need database setup. Apply migration 0106, then reload this form." };
  if (error) return { error: catalogSaveError(error, "promo", Boolean(id)) };
  revalidatePath("/dashboard/promos");
  revalidatePath("/shop/[slug]", "page");
  revalidatePath("/shop/[slug]/book", "page");
  redirect("/dashboard/promos");
}
