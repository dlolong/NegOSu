import React from "react";
import { createRoot } from "react-dom/client";
import { CommandCenter } from "@/components/command-center/command-center";
import { DashboardDiscoveryContent } from "@/components/dashboard-discovery-content";
import { SettingsNavigation } from "@/components/settings-navigation";
import { dashboardFeaturePreviews, publicWebsiteSummary } from "@/lib/dashboard-discovery";

const settings = new URLSearchParams(location.search).has("settings");
createRoot(document.getElementById("root")!).render(<div className="lg:pl-56">
  {settings ? <div id="settings-workspace" className="grid min-w-0 items-start gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
    <SettingsNavigation industry="salon"/>
    <section id="settings-workspace-content" className="min-w-0 rounded-xl border p-4"><h1>Profile & workspace</h1><p>Business details and workspace preferences</p></section>
  </div> : <CommandCenter
    snapshot={{ scope: { mode: "branch", organizationId: "test", branchIds: ["main"], selectedBranchId: "main", label: "Main branch", currency: "PHP" }, metrics: [{ key: "appointments_today", label: "Appointments today", value: 12, valueKind: "count" }], actions: [], operations: [], staff: [], branchPerformance: [] }}
    firstName="Alex" branches={[{ id: "main", name: "Main branch" }]} todayTitle="Today's appointments" todayDescription="Current branch schedule" todayVerticalId="test-appointments" staffDescription="Your team today"
    quickActions={[{ id: "appointment", primary: true, label: "New appointment", description: "Schedule a visit", href: "/dashboard/appointments/new" }]}
    discovery={<DashboardDiscoveryContent canManage website={publicWebsiteSummary("https://example.com", "long-business-name-for-mobile-url-wrapping-checks", { status: "active", public_page_enabled: true })} features={dashboardFeaturePreviews("salon", "owner")}/>}
  />}
</div>);
