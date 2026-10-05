import React from "react";
import { createRoot } from "react-dom/client";
import { CommandCenter } from "@/components/command-center/command-center";
import { DashboardDiscoveryContent } from "@/components/dashboard-discovery-content";
import { dashboardFeaturePreviews, publicWebsiteSummary } from "@/lib/dashboard-discovery";
import type { SharedCommandCenterSnapshot } from "@/modules/core/command-center";

const root = document.getElementById("root")!;
root.className = "p-4 lg:ml-60 lg:p-6";
const snapshot: SharedCommandCenterSnapshot = {
  scope: { mode: "branch", organizationId: "org", branchIds: ["main"], selectedBranchId: "main", label: "Main Branch", currency: "PHP" },
  metrics: [
    { key: "revenue_today", label: "Collected today", value: 0, valueKind: "currency", helperText: "Paid payments received today" },
    { key: "appointments_today", label: "Appointments Today", value: 0, valueKind: "count" },
    { key: "outstanding", label: "Outstanding", value: 0, valueKind: "currency" },
    { key: "low_stock", label: "Low Stock", value: 0, valueKind: "count" },
    { key: "attention", label: "Needs Attention", value: 0, valueKind: "count" },
  ],
  actions: [], operations: [], staff: [], branchPerformance: [],
};
createRoot(root).render(<CommandCenter snapshot={snapshot} firstName="Juan" branches={[{ id: "main", name: "Main Branch" }]}
  todayTitle="Today’s Appointments" todayDescription="Clients, Treatments, assigned Staff, and visit status." todayVerticalId="salon-today" staffDescription="Current and next assigned Client visits."
  quickActions={[
    { id: "add-walk-in", label: "Add walk-in", description: "Start a visit", href: "/dashboard/appointments/new", primary: true },
    { id: "new-appointment", label: "Book appointment", description: "Book a visit", href: "/dashboard/appointments/new", primary: true },
    { id: "staff", label: "Manage Staff", description: "Manage your team", href: "/dashboard/settings/staff" },
  ]}
  discovery={<DashboardDiscoveryContent canManage website={publicWebsiteSummary("https://example.com", "executivefacialcare", { status: "active", public_page_enabled: true })} features={dashboardFeaturePreviews("salon", "owner")}/>}
/>);
