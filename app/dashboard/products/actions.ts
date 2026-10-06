"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { businessLogoUrlSchema } from "@/modules/platform/business-branding";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogPrice } from "@/modules/core/commerce/pricing";
import { catalogSaveError } from "@/modules/core/commerce/save-errors";
import type { CatalogActionState } from "@/app/dashboard/promos/actions";

const schema = z.object({ name: z.string().trim().min(2).max(120), sku: z.string().trim().max(60), description: z.string().trim().max(1000), category: z.string().trim().min(1, "Enter a product category.").max(80), unit: z.string().trim().min(1).max(30), price: z.number().int().min(0).max(10_000_000_000), purpose: z.enum(["retail", "internal", "both"]), thumbnailUrl: businessLogoUrlSchema, isPublic: z.boolean(), id: z.uuid().nullable() });
export async function saveProduct(_previous: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const { activeMembership: m } = await getDashboardContext();
  if (!["owner", "manager"].includes(m.role)) return { error: "Product management access required." };
  if (parseCatalogPrice(String(form.get("price"))) === null) return { error: "Enter a valid price from 0 to 100,000,000 with no more than two decimal places." };
  const parsed = schema.safeParse({ ...Object.fromEntries(form), id: form.get("id") || null, thumbnailUrl: form.get("thumbnailUrl") ?? "", isPublic: form.get("isPublic") === "on", price: parseCatalogPrice(String(form.get("price"))) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check product details." };
  const v = parsed.data;
  if (v.isPublic && v.purpose === "internal") return { error: "Internal supplies cannot be shown on the public website." };
  if (!z.uuid().safeParse(form.get("requestKey")).success) return { error: "Reload this form before saving." };
  const db = await createClient();
  const { error } = await db.rpc("save_commerce_product", { p_request: form.get("requestKey"), p_org: m.organizationId, p_branch: m.branchId, p_id: v.id, p_name: v.name, p_sku: v.sku, p_description: v.description, p_category: v.category, p_unit: v.unit, p_price: v.price, p_purpose: v.purpose, p_tracked: form.get("tracked") === "on", p_active: form.get("active") === "on", p_is_public: v.isPublic, p_thumbnail_url: v.thumbnailUrl });
  if (error) return { error: catalogSaveError(error, "product", Boolean(v.id)) };
  revalidatePath("/dashboard/products"); revalidatePath("/dashboard/inventory");
  revalidatePath("/shop/[slug]", "page");
  redirect("/dashboard/products");
}
