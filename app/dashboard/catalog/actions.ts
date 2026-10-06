"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { updateCatalogPhoto } from "@/modules/core/catalog/photo";

export async function saveCatalogPhoto(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  const result = await updateCatalogPhoto(await createClient(), activeMembership, input);
  if (result.error) return result;
  for (const path of ["/dashboard/products", "/dashboard/promos", "/dashboard/services", "/dashboard/inventory", "/dashboard/settings/public-page", "/dashboard/checkout"]) revalidatePath(path, "layout");
  revalidatePath("/shop/[slug]", "layout");
  return {};
}
