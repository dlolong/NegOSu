import type { OrganizationMembership } from "@/lib/auth/context";
import { resolveIndustryConfig } from "@/modules/platform/industry";
import { navigationForIndustry } from "@/modules/platform/navigation";

const featureDescriptions: Record<string, string> = {
  bookings: "Review online booking requests.",
  inbox: "Keep customer conversations in one place.",
  reports: "See how your business is performing.",
  inventory: "Track stock and replenishment.",
  resources: "Manage spaces and service capacity.",
  branches: "Manage your business locations.",
};

export function dashboardFeaturePreviews(industry: string, role: OrganizationMembership["role"]) {
  const navigation = navigationForIndustry(resolveIndustryConfig(industry), role);
  return Object.entries(featureDescriptions).flatMap(([key, description]) => {
    const item = navigation.find(item => item.key === key);
    return item ? [{ key, label: item.label, href: item.href, description }] : [];
  }).slice(0, 3);
}

export function publicWebsiteSummary(appUrl: string, slug: string, organization: { public_page_enabled: boolean; status: string } | null) {
  const status = !organization ? "unavailable" : organization.status !== "active" ? "inactive" : organization.public_page_enabled ? "published" : "draft";
  return { status, url: new URL(`/shop/${encodeURIComponent(slug)}`, appUrl).toString() } as const;
}
