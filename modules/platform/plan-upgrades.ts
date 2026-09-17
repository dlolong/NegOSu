import { z } from "zod";
import { resolveIndustryConfig, type IndustryKey } from "./industry";

const limits = z.record(z.string(), z.number().int().min(-1));
const features = z.record(z.string(), z.boolean());
export const upgradePlanSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), sort_order: z.number().int(),
  is_active: z.boolean(), limits, features,
});
export const upgradeEntitlementsSchema = z.object({
  planId: z.string().min(1), planName: z.string().min(1), limits, features,
});
export type UpgradeState = {
  current: z.infer<typeof upgradeEntitlementsSchema>;
  higherPlans: z.infer<typeof upgradePlanSchema>[];
};
export type UpgradeCapability = "advanced_reports" | "public_page" | "reminders" | "staff" | "branches" | "monthly_jobs";

/** Presentation only: effective entitlements and database enforcement remain authoritative. */
export function resolveUpgradeState(entitlements: unknown, catalog: unknown): UpgradeState | null {
  const current = upgradeEntitlementsSchema.safeParse(entitlements);
  const plans = z.array(upgradePlanSchema).safeParse(catalog);
  if (!current.success || !plans.success) return null;
  const currentPlan = plans.data.find(plan => plan.id === current.data.planId);
  if (!currentPlan) return null;
  const higherPlans = plans.data.filter(plan => plan.is_active && plan.sort_order > currentPlan.sort_order)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return higherPlans.length ? { current: current.data, higherPlans } : null;
}

function supportsCapability(industry: IndustryKey, capability: UpgradeCapability) {
  const supported = resolveIndustryConfig(industry).features;
  if (capability === "public_page") return supported.booking_requests;
  if (capability === "reminders") return supported.maintenance;
  if (capability === "advanced_reports") return supported.reports;
  if (capability === "monthly_jobs") return supported.job_orders;
  return true;
}

const featureLabels = {
  advanced_reports: "custom report dates, detailed reports and CSV exports",
  public_page: "publishing your public website and accepting online booking requests",
  reminders: "maintenance reminders",
};
const limitLabels = { staff: "staff logins", branches: "active branches", monthly_jobs: "jobs per month" };

export function selectUpgrade(state: UpgradeState | null, industry: IndustryKey, capability: UpgradeCapability, limitReached = false) {
  if (!state) return null;
  if (!supportsCapability(industry, capability)) return null;
  if (capability in featureLabels) {
    if (state.current.features[capability] !== false) return null;
    const plan = state.higherPlans.find(plan => plan.features[capability] === true);
    return plan ? { plan, description: `${plan.name} includes ${featureLabels[capability as keyof typeof featureLabels]}.` } : null;
  }
  if (!limitReached) return null;
  const limit = state.current.limits[capability];
  if (limit == null || limit < 0) return null;
  const plan = state.higherPlans.find(plan => plan.limits[capability] === -1 || plan.limits[capability] > limit);
  return plan ? { plan, description: `${state.current.planName} allows ${limit} ${limitLabels[capability as keyof typeof limitLabels]}. This limit has been reached. Explore ${plan.name} for more capacity.` } : null;
}

export function upgradeDestination(planId: string, isOwner: boolean) {
  return isOwner ? `/dashboard/settings/billing#billing-plan-${encodeURIComponent(planId)}` : "/plans";
}
