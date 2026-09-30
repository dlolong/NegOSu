import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicPromo } from "./public-promos";
export const loadPublicPromos = cache(async (slug: string): Promise<{ promos: PublicPromo[]; unavailable: boolean }> => {
  const {data,error}=await createPublicClient().rpc("get_public_promos",{p_slug:slug});
  return {promos:error?[]:(data??[]) as PublicPromo[],unavailable:Boolean(error)};
});
