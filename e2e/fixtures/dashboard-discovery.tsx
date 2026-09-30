import React from "react";
import { createRoot } from "react-dom/client";
import { DashboardDiscoveryContent } from "@/components/dashboard-discovery-content";
import { dashboardFeaturePreviews, publicWebsiteSummary } from "@/lib/dashboard-discovery";

const state = new URLSearchParams(location.search).get("state") ?? "published";
createRoot(document.getElementById("root")!).render(<DashboardDiscoveryContent
  website={publicWebsiteSummary("https://example.com", "a-long-business-name-that-should-wrap-comfortably-on-a-mobile-phone", state === "unavailable" ? null : { status: "active", public_page_enabled: state === "published" })}
  canManage={state !== "staff"}
  features={dashboardFeaturePreviews("salon", state === "staff" ? "advisor" : "owner")}
/>);
