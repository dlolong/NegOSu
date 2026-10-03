import { getDashboardContext } from "@/lib/auth/context";
import { clientEnv } from "@/lib/env/client";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { dashboardFeaturePreviews, publicWebsiteSummary } from "@/lib/dashboard-discovery";
import { resolveIndustryConfig } from "@/modules/platform/industry";
import { DashboardDiscoveryContent } from "@/components/dashboard-discovery-content";

export async function DashboardDiscovery() {
  const { activeMembership: membership } = await getDashboardContext();
  const features = dashboardFeaturePreviews(membership.industry, membership.role);
  const supportsWebsite = resolveIndustryConfig(membership.industry).features.public_website;
  let organization: { public_page_enabled: boolean; status: string } | null = null;
  if (supportsWebsite) {
    try {
      const db = await createClient();
      const { data, error } = await db.from("organizations").select("public_page_enabled,status").eq("id", membership.organizationId).maybeSingle();
      if (!error) organization = data;
    } catch { /* A secondary status lookup must not block operational work. */ }
  }
  const website = supportsWebsite ? publicWebsiteSummary(clientEnv.NEXT_PUBLIC_APP_URL, membership.organizationSlug, organization) : null;
  return <DashboardDiscoveryContent acceptsBookings={resolveIndustryConfig(membership.industry).features.booking_requests} website={website} canManage={roleHasPermission(membership.role, "settings.manage")} features={features}/>;
}

