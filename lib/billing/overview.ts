import type { SupabaseClient } from "@supabase/supabase-js";
import { findLaunchPlan, planMatchesLaunchCatalog } from "@/modules/platform/plan-catalog";

export type BillingPlan = {
  id: string; name: string; monthly_price_centavos: number; yearly_price_centavos: number | null;
  limits: Record<string, number>; features: Record<string, boolean>;
  is_custom: boolean; provider_monthly_price_id: string | null; provider_yearly_price_id: string | null;
  matchesCatalog: boolean;
};
export type BillingSubscription = {
  plan_id: string; status: string; current_period_end: string | null;
  cancel_at_period_end: boolean; provider_customer_id: string | null;
};
export type BillingEntitlements = {
  planId: string; planName: string; graceEndsAt: string | null;
};
type BasePlan = Omit<BillingPlan, "is_custom" | "provider_monthly_price_id" | "provider_yearly_price_id" | "matchesCatalog">;
type Configuration = Pick<BillingPlan, "id" | "is_custom" | "provider_monthly_price_id" | "provider_yearly_price_id">;

// Base billing remains readable while provider setup is unavailable. Never invent
// effective entitlements or enable checkout from the public marketing catalog.
export async function loadBillingOverview(db: Pick<SupabaseClient, "from" | "rpc">, organizationId: string) {
  const [catalog, subscription, configuration, entitlements] = await Promise.all([
    db.from("plans").select("id,name,monthly_price_centavos,yearly_price_centavos,limits,features").eq("is_active", true).order("sort_order"),
    db.from("organization_subscriptions").select("plan_id,status,current_period_end,cancel_at_period_end,provider_customer_id").eq("organization_id", organizationId).maybeSingle(),
    db.from("plans").select("id,is_custom,provider_monthly_price_id,provider_yearly_price_id").eq("is_active", true),
    db.rpc("get_org_entitlements", { p_organization_id: organizationId }),
  ]);
  const effective = !entitlements.error ? entitlements.data as BillingEntitlements | null : null;
  const paymentSetupAvailable = !configuration.error && Boolean(configuration.data) && Boolean(effective) && !subscription.error;
  const configurations = new Map((configuration.error ? [] : configuration.data as Configuration[] ?? []).map(plan => [plan.id, plan]));
  const plans = (catalog.error ? [] : catalog.data as BasePlan[] ?? []).map(plan => {
    const config = configurations.get(plan.id);
    const fullPlan = { ...plan, is_custom: config?.is_custom ?? findLaunchPlan(plan.id)?.custom ?? false };
    const matchesCatalog = planMatchesLaunchCatalog(fullPlan);
    return {
      ...fullPlan, matchesCatalog,
      provider_monthly_price_id: paymentSetupAvailable && matchesCatalog ? config?.provider_monthly_price_id ?? null : null,
      provider_yearly_price_id: paymentSetupAvailable && matchesCatalog ? config?.provider_yearly_price_id ?? null : null,
    };
  });
  return {
    plans, subscription: subscription.error ? null : subscription.data as BillingSubscription | null,
    effective, catalogUnavailable: Boolean(catalog.error), subscriptionUnavailable: Boolean(subscription.error),
    paymentSetupAvailable,
  };
}
export type BillingOverview = Awaited<ReturnType<typeof loadBillingOverview>>;
