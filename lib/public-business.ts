import "server-only";
import { cache } from "react";
import type { PublicShop } from "@/lib/public-booking";
import { createPublicClient } from "@/lib/supabase/public";

// The publication checks and allowed public fields belong to this existing RPC.
export const loadPublicBusiness = cache(async (slug: string): Promise<PublicShop | null> => {
  const { data, error } = await createPublicClient().rpc("get_public_shop", { p_slug: slug });
  if (error) throw new Error("Unable to load this business. Please try again.");
  return data as PublicShop | null;
});
