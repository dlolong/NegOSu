import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUpgradeState } from "@/modules/platform/plan-upgrades";

/** Session-scoped reads only; never share one workspace's entitlements through a global cache. */
export async function loadPlanUpgrades(db: Pick<SupabaseClient, "from" | "rpc">, organizationId: string) {
  try {
    const [entitlements, plans] = await Promise.all([
      db.rpc("get_org_entitlements", { p_organization_id: organizationId }),
      db.from("plans").select("id,name,sort_order,is_active,limits,features").eq("is_active", true).order("sort_order"),
    ]);
    if (entitlements.error || plans.error) return null;
    return resolveUpgradeState(entitlements.data, plans.data);
  } catch {
    // Optional upgrade guidance must never prevent daily operations from loading.
    return null;
  }
}
