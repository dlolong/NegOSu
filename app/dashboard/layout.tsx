import { loadPlanUpgrades } from "@/lib/billing/upgrades";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { getDashboardContext } from "@/lib/auth/context";
import { businessMetadata } from "@/modules/platform/business-branding";

export async function generateMetadata() {
  const { activeMembership } = await getDashboardContext();
  return { ...businessMetadata(activeMembership.organizationName, activeMembership.organizationLogoUrl), robots: { index: false, follow: false } };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getDashboardContext();
  const upgrades = await loadPlanUpgrades(await createClient(), context.activeMembership.organizationId);
  return <AppShell upgrades={upgrades} activeMembership={context.activeMembership} memberships={context.memberships} profileName={context.profile.fullName} dashboardTheme={context.profile.dashboardTheme}>{children}</AppShell>;
}
