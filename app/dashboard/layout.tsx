import { CreditDashboardNotice } from "@/components/credit-dashboard-notice";
import { LookupScopeProvider } from "@/components/lookup-scope";
import { isPlatformAdmin } from "@/modules/platform/admin-access";
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
  const scope = JSON.stringify([context.user.id, context.activeMembership.organizationId, context.activeMembership.branchId, context.activeMembership.role]);
  return <AppShell platformAdmin={isPlatformAdmin(context.user.id, process.env.PLATFORM_ADMIN_USER_IDS)} upgrades={upgrades} activeMembership={context.activeMembership} memberships={context.memberships} profileName={context.profile.fullName} dashboardTheme={context.profile.dashboardTheme}><LookupScopeProvider key={scope} scope={scope}>{context.activeMembership.role === "owner" ? <CreditDashboardNotice key={context.activeMembership.organizationId} organizationId={context.activeMembership.organizationId}/> : null}{children}</LookupScopeProvider></AppShell>;
}
